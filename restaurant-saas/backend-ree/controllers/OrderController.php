<?php

class OrderController
{
    // GET /orders
    public function index(): void
    {
        $user     = Auth::requireRole(['super_admin', 'owner', 'manager', 'cashier', 'chef']);
        $branchId = (int) Request::query('branch_id');
        if (!$branchId) Response::error('branch_id is required.', 422);
        if (!Auth::canAccessBranch($user, $branchId)) Response::forbidden();

        $pdo    = Database::get();
        $where  = ['o.branch_id = ?', 'o.deleted_at IS NULL'];
        $params = [$branchId];

        // ─── Status filter ────────────────────
        $status   = Request::query('status');
        $statuses = Request::query('statuses');

        if ($statuses) {
            $allowed  = ['pending','accepted','preparing','served','ready','delivered','completed','cancelled'];
            $list     = array_filter(
                array_map('trim', explode(',', $statuses)),
                fn($s) => in_array($s, $allowed)
            );
            if (!empty($list)) {
                $placeholders = implode(',', array_fill(0, count($list), '?'));
                $where[]      = "o.status IN ({$placeholders})";
                array_push($params, ...$list);
            }
        } elseif ($status) {
            if ($status === 'active') {
                $where[] = "o.status NOT IN ('delivered','completed','cancelled')";
            } else {
                $where[]  = 'o.status = ?';
                $params[] = $status;
            }
        }

        // ─── Today filter ─────────────────────
        if (Request::query('today')) {
            $where[] = 'DATE(o.created_at) = CURDATE()';
        }

        // ─── Search ───────────────────────────
        if ($search = Request::query('search')) {
            $where[]  = '(o.order_number LIKE ? OR o.customer_name LIKE ?)';
            $like     = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
        }

        $whereStr = implode(' AND ', $where);
        $perPage  = min((int)(Request::query('per_page') ?? 30), 500);
        $page     = max((int)(Request::query('page') ?? 1), 1);
        $offset   = ($page - 1) * $perPage;

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM orders o WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $pdo->prepare("
            SELECT o.* FROM orders o
            WHERE {$whereStr}
            ORDER BY o.created_at DESC
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$order) {
            $order = $this->attachItems($pdo, $order);
        }

        Response::paginated($orders, $total, $page, $perPage);
    }

    // GET /orders/:id
    public function show(array $params): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager', 'cashier', 'chef']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $order = $stmt->fetch();

        if (!$order) Response::notFound('Order not found.');
        if (!Auth::canAccessBranch($user, (int)$order['branch_id'])) Response::forbidden();

        Response::success($this->attachItems($pdo, $order));
    }

    // GET /orders/track/:orderNumber (public)
    public function track(array $params): void
    {
        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = ? AND deleted_at IS NULL');
        $stmt->execute([$params['orderNumber']]);
        $order = $stmt->fetch();

        if (!$order) Response::notFound('Order not found.');

        if (!empty($order['branch_id'])) {
            $bs = $pdo->prepare(
                'SELECT b.*, r.name AS restaurant_name, r.slug AS restaurant_slug
                 FROM branches b
                 LEFT JOIN restaurants r ON r.id = b.restaurant_id
                 WHERE b.id = ? AND b.deleted_at IS NULL'
            );
            $bs->execute([(int)$order['branch_id']]);
            $brow = $bs->fetch();
            if ($brow) {
                $order['branch'] = [
                    'id'              => (int)$brow['id'],
                    'name'            => $brow['name'] ?? ($brow['restaurant_name'] ?? null),
                    'slug'            => $brow['slug'] ?? null,
                    'currency_symbol' => $brow['currency_symbol'] ?? null,
                    'settings'        => jsonDecode($brow['settings'] ?? null),
                ];
            }
        }

        $order = $this->attachItems($pdo, $order);

        if ($order['customer_phone']) {
            $decrypted               = Auth::decrypt($order['customer_phone']);
            $order['customer_phone'] = '****' . substr($decrypted, -4);
        }
        $order['customer_address'] = $order['customer_address'] ? '***' : null;

        Response::success($order);
    }

    // GET /orders/guest?guest_id=
    public function guestOrders(): void
    {
        $guestId = Request::query('guest_id');
        if (!$guestId) Response::error('guest_id is required.', 422);

        $pdo  = Database::get();
        $stmt = $pdo->prepare('
            SELECT * FROM orders
            WHERE guest_id = ? AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 20
        ');
        $stmt->execute([$guestId]);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$order) {
            $order = $this->attachItems($pdo, $order);
        }

        Response::success($orders);
    }

    // POST /orders
    public function store(): void
    {
        $body     = Request::body();
        $branchId = (int)($body['branch_id'] ?? 0);

        if (!$branchId)                     Response::error('branch_id is required.', 422);
        if (empty($body['type']))           Response::error('type is required.', 422);
        if (empty($body['payment_method'])) Response::error('payment_method is required.', 422);
        if (empty($body['customer_name']))  Response::error('customer_name is required.', 422);
        if (empty($body['items']))          Response::error('items are required.', 422);

        $type = $body['type'];

        if ($type === 'delivery') {
            if (empty($body['customer_phone']))   Response::error('Phone is required for delivery.', 422);
            if (empty($body['customer_address'])) Response::error('Address is required for delivery.', 422);
        }
        if ($type === 'pickup' && empty($body['customer_phone'])) {
            Response::error('Phone is required for pickup.', 422);
        }

        $guestId = $body['guest_id'] ?? null;
        if ($guestId && !rateLimit("guest_order:{$guestId}", 5, 3600)) {
            Response::error('Too many orders. Please wait before placing another.', 429);
        }

        $pdo      = Database::get();
        $subtotal = 0.0;
        $orderItems = [];

        foreach ($body['items'] as $item) {
            $productId = (int)($item['product_id'] ?? 0);
            $qty       = max(1, (int)($item['quantity'] ?? 1));

            $stmt = $pdo->prepare("
                SELECT * FROM products
                WHERE id = ? AND branch_id = ? AND status = 'active' AND deleted_at IS NULL
            ");
            $stmt->execute([$productId, $branchId]);
            $product = $stmt->fetch();

            if (!$product) {
                Response::error("Product #{$productId} is not available.", 422);
            }

            $unitPrice = (float)$product['price'];

            $variantName = null;
            if (!empty($item['variant_id'])) {
                $vs = $pdo->prepare('SELECT name, price_modifier FROM product_variants WHERE id = ? AND product_id = ?');
                $vs->execute([$item['variant_id'], $productId]);
                $variant = $vs->fetch();
                if ($variant) {
                    $unitPrice  += (float)$variant['price_modifier'];
                    $variantName = $variant['name'];
                }
            }

            $addonNames = [];
            $addonTotal = 0.0;
            if (!empty($item['addon_ids']) && is_array($item['addon_ids'])) {
                $in = implode(',', array_map('intval', $item['addon_ids']));
                $as = $pdo->query("SELECT name, price FROM product_addons WHERE id IN ({$in}) AND product_id = {$productId}");
                foreach ($as->fetchAll() as $addon) {
                    $addonNames[] = $addon['name'];
                    $addonTotal  += (float)$addon['price'];
                }
                $unitPrice += $addonTotal;
            }

            $lineTotal  = $unitPrice * $qty;
            $subtotal  += $lineTotal;

            $orderItems[] = [
                'product_id'           => $productId,
                'product_name'         => $product['name'],
                'product_image'        => $product['image'],
                'quantity'             => $qty,
                'unit_price'           => $unitPrice,
                'total_price'          => $lineTotal,
                'variant_name'         => $variantName,
                'addons'               => json_encode($addonNames),
                'special_instructions' => sanitize($item['special_instructions'] ?? ''),
            ];
        }

        // ─── Coupon ───────────────────────────
        $discount = 0.0;
        $couponId = null;
        if (!empty($body['coupon_id'])) {
            $cs = $pdo->prepare("
                SELECT * FROM coupons
                WHERE id = ? AND branch_id = ? AND is_active = 1 AND deleted_at IS NULL
            ");
            $cs->execute([$body['coupon_id'], $branchId]);
            $coupon = $cs->fetch();
            if ($coupon && isCouponValid($coupon, $subtotal)) {
                $discount = calcDiscount($coupon, $subtotal);
                $couponId = $coupon['id'];
                $pdo->prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')
                    ->execute([$couponId]);
            }
        }

        // ─── Delivery fee ─────────────────────
        $deliveryFee = 0.0;
        if ($type === 'delivery') {
            $bs = $pdo->prepare('SELECT settings FROM branches WHERE id = ?');
            $bs->execute([$branchId]);
            $branchRow   = $bs->fetch();
            $settings    = jsonDecode($branchRow['settings'] ?? null);
            $deliveryFee = (float)($settings['delivery_fee'] ?? 15.00);
        }

        $total       = max(0, $subtotal - $discount + $deliveryFee);
        $orderNumber = generateOrderNumber($branchId);

        $phone   = !empty($body['customer_phone'])   ? Auth::encrypt($body['customer_phone'])   : null;
        $address = !empty($body['customer_address']) ? Auth::encrypt($body['customer_address']) : null;

        // ─── Status logic ─────────────────────
        // ALL order types start at "pending" — cashier accepts first.
        // This ensures dine-in also passes through accepted → preparing → served.
        $initialStatus = 'pending';
        $paymentStatus = 'pending';

        $pdo->prepare("
            INSERT INTO orders
                (branch_id, user_id, guest_id, order_number, type, status,
                 payment_method, payment_status, customer_name, customer_phone,
                 customer_address, table_number, special_instructions,
                 subtotal, discount, delivery_fee, tax, total, coupon_id,
                 estimated_ready_at, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $branchId,
            !empty($body['user_id']) ? (int)$body['user_id'] : null,
            $guestId,
            $orderNumber,
            $type,
            $initialStatus,
            $body['payment_method'],
            $paymentStatus,
            sanitize($body['customer_name']),
            $phone,
            $address,
            sanitize($body['table_number'] ?? ''),
            sanitize($body['special_instructions'] ?? ''),
            $subtotal,
            $discount,
            $deliveryFee,
            0,
            $total,
            $couponId,
            date('Y-m-d H:i:s', strtotime('+25 minutes')),
            now(), now(),
        ]);

        $orderId = (int)$pdo->lastInsertId();

        foreach ($orderItems as $item) {
            $pdo->prepare("
                INSERT INTO order_items
                    (branch_id, order_id, product_id, product_name, product_image,
                     quantity, unit_price, total_price, variant_name, addons,
                     special_instructions, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ")->execute([
                $branchId, $orderId,
                $item['product_id'], $item['product_name'], $item['product_image'],
                $item['quantity'], $item['unit_price'], $item['total_price'],
                $item['variant_name'], $item['addons'], $item['special_instructions'],
                now(), now(),
            ]);
        }

        if ($guestId) {
            $pdo->prepare("
                UPDATE guest_sessions
                SET order_count = order_count + 1, last_active_at = ?
                WHERE guest_id = ?
            ")->execute([now(), $guestId]);
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);

        Response::created($this->attachItems($pdo, $stmt->fetch()), 'Order placed successfully!');
    }

    // PATCH /orders/:id/status
    public function updateStatus(array $params): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'cashier', 'chef']);
        $data = Request::validate([
            'status' => 'required|in:accepted,preparing,served,ready,delivered,completed,cancelled',
        ]);

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $order = $stmt->fetch();

        if (!$order) Response::notFound('Order not found.');
        if (!Auth::canAccessBranch($user, (int)$order['branch_id'])) Response::forbidden();

        $isDineIn = ($order['type'] === 'dine_in');
        $role     = $user['role'];
        $newStatus = $data['status'];

        // ─── Role-based restrictions ──────────
        //
        // Chef:
        //   - Can mark ANY order (dine-in or delivery/pickup) as "preparing"
        //     when it is in "accepted" state (kitchen starts cooking).
        //   - Can mark dine-in orders as "served" when in "preparing" state.
        //   - Cannot touch delivery/pickup beyond "preparing".
        //
        // Cashier:
        //   - Handles everything: accept, prepare, ready, delivered, served, etc.
        //
        if ($role === 'chef') {
            $chefAllowed = [
                'accepted'  => ['preparing'],           // chef starts cooking (all types)
                'preparing' => ['served'],              // chef marks dine-in served (dine-in only)
            ];

            $allowedForChef = $chefAllowed[$order['status']] ?? [];

            if (!in_array($newStatus, $allowedForChef)) {
                Response::forbidden(
                    "Chefs can only move orders from 'accepted' to 'preparing', or from 'preparing' to 'served' (dine-in only)."
                );
            }

            // Extra guard: chef cannot mark delivery/pickup as "served"
            if ($newStatus === 'served' && !$isDineIn) {
                Response::forbidden("Chefs can only mark dine-in orders as served.");
            }
        }

        // ─── Valid transitions per order type ─
        //
        //  Dine-in:
        //    pending → accepted → preparing → served → [checkout handled by /checkout] → completed
        //    any non-completed/cancelled → cancelled
        //
        //  Delivery / Pickup:
        //    pending → accepted → preparing → ready → delivered
        //    any non-completed/cancelled → cancelled
        //
        if ($isDineIn) {
            $allowed = [
                'pending'   => ['accepted',  'cancelled'],
                'accepted'  => ['preparing', 'cancelled'],
                'preparing' => ['served',    'cancelled'],
                'served'    => ['cancelled'],              // payment goes through /checkout
            ];
        } else {
            $allowed = [
                'pending'   => ['accepted',  'cancelled'],
                'accepted'  => ['preparing', 'cancelled'],
                'preparing' => ['ready',     'cancelled'],
                'ready'     => ['delivered', 'completed'],
            ];
        }

        if (!in_array($newStatus, $allowed[$order['status']] ?? [])) {
            Response::error(
                "Cannot change status from '{$order['status']}' to '{$newStatus}'.", 422
            );
        }

        // ─── Timestamps ───────────────────────
        $extra = [];
        switch ($newStatus) {
            case 'accepted':
                $extra = ['accepted_at' => now()];
                break;
            case 'preparing':
                $extra = ['accepted_at' => $order['accepted_at'] ?? now()];
                break;
            case 'served':
                $extra = ['served_at' => now()];
                break;
            case 'ready':
                $extra = ['ready_at' => now()];
                break;
            case 'delivered':
            case 'completed':
                $extra = ['delivered_at' => now()];
                break;
            default:
                $extra = [];
                break;
        }

        $extra['status']     = $newStatus;
        $extra['updated_at'] = now();

        $set    = implode(', ', array_map(fn($k) => "{$k} = ?", array_keys($extra)));
        $values = [...array_values($extra), $params['id']];

        $pdo->prepare("UPDATE orders SET {$set} WHERE id = ?")->execute($values);

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$params['id']]);

        Response::success(
            $this->attachItems($pdo, $stmt->fetch()),
            "Status updated to '{$newStatus}'."
        );
    }

    // PATCH /orders/:id/checkout
    // Cashier records payment and closes dine-in order after it's been served
    public function checkout(array $params): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'cashier']);
        $data = Request::validate([
            'payment_method' => 'required|in:cash,card',
        ]);

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $order = $stmt->fetch();

        if (!$order) Response::notFound('Order not found.');
        if (!Auth::canAccessBranch($user, (int)$order['branch_id'])) Response::forbidden();

        if ($order['type'] !== 'dine_in') {
            Response::error('Checkout endpoint is for dine-in orders only.', 422);
        }

        // Must be served before payment can be recorded
        if ($order['status'] !== 'served') {
            Response::error(
                "Order must be in 'served' status to process payment. Current: '{$order['status']}'.",
                422
            );
        }

        if ($order['payment_status'] === 'paid') {
            Response::error('Order is already paid.', 422);
        }

        $extra = [
            'payment_status' => 'paid',
            'payment_method' => $data['payment_method'],
            'status'         => 'completed',
            'delivered_at'   => now(),
            'updated_at'     => now(),
        ];

        $set    = implode(', ', array_map(fn($k) => "{$k} = ?", array_keys($extra)));
        $values = [...array_values($extra), $params['id']];

        $pdo->prepare("UPDATE orders SET {$set} WHERE id = ?")->execute($values);

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$params['id']]);

        Response::success($this->attachItems($pdo, $stmt->fetch()), 'Payment recorded and order completed.');
    }

    // ─── Helper ──────────────────────────────
    private function attachItems(PDO $pdo, array $order): array
    {
        $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
        $stmt->execute([$order['id']]);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['id']          = (int)$item['id'];
            $item['quantity']    = (int)$item['quantity'];
            $item['unit_price']  = (float)$item['unit_price'];
            $item['total_price'] = (float)$item['total_price'];
            $item['addons']      = jsonDecode($item['addons']);
        }

        $order['items']        = $items;
        $order['id']           = (int)$order['id'];
        $order['branch_id']    = (int)$order['branch_id'];
        $order['subtotal']     = (float)$order['subtotal'];
        $order['discount']     = (float)$order['discount'];
        $order['delivery_fee'] = (float)$order['delivery_fee'];
        $order['tax']          = (float)$order['tax'];
        $order['total']        = (float)$order['total'];

        return $order;
    }
}