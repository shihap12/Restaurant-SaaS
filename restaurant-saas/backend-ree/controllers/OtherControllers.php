<?php

// ─── CategoryController ──────────────────────
class CategoryController
{
    public function index(): void
    {
        $branchId = (int) Request::query('branch_id');
        if (!$branchId) Response::error('branch_id is required.', 422);

        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            SELECT c.*, COUNT(p.id) AS products_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL AND p.status = 'active'
            WHERE c.branch_id = ? AND c.is_active = 1
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.name ASC
        ");
        $stmt->execute([$branchId]);

        $cats = $stmt->fetchAll();
        foreach ($cats as &$c) {
            $c['id']             = (int)$c['id'];
            $c['products_count'] = (int)$c['products_count'];
            $c['is_active']      = (bool)$c['is_active'];
        }

        Response::success($cats);
    }

    public function store(): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $data = Request::validate([
            'branch_id'     => 'required|integer',
            'restaurant_id' => 'required|integer',
            'name'          => 'required|max:100',
            'name_ar'       => '',
            'description'   => '',
            'sort_order'    => '',
        ]);

        if (!Auth::canAccessBranch($user, (int)$data['branch_id'])) Response::forbidden();

        $imageUrl = null;
        if (!empty($_FILES['image']['name'])) {
            $imageUrl = uploadFile($_FILES['image'], 'categories');
        }

        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            INSERT INTO categories (branch_id, restaurant_id, name, name_ar, description, image, sort_order, is_active, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,1,?,?)
        ");
        $stmt->execute([
            $data['branch_id'], $data['restaurant_id'],
            sanitize($data['name']),
            sanitize($data['name_ar'] ?? ''),
            sanitize($data['description'] ?? ''),
            $imageUrl,
            (int)($data['sort_order'] ?? 0),
            now(), now(),
        ]);

        $id   = $pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
        $stmt->execute([$id]);

        Response::created($stmt->fetch(), 'Category created.');
    }

    public function update(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
        $stmt->execute([$params['id']]);
        $cat = $stmt->fetch();
        if (!$cat) Response::notFound();

        $pdo->prepare("
            UPDATE categories SET name=?,name_ar=?,description=?,sort_order=?,is_active=?,updated_at=?
            WHERE id=?
        "
        )->execute([
            sanitize($body['name']        ?? $cat['name']),
            sanitize($body['name_ar']     ?? $cat['name_ar']),
            sanitize($body['description'] ?? $cat['description']),
            $body['sort_order']  ?? $cat['sort_order'],
            isset($body['is_active']) ? (int)$body['is_active'] : $cat['is_active'],
            now(), $params['id'],
        ]);

        $stmt = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
        $stmt->execute([$params['id']]);
        Response::success($stmt->fetch());
    }

    public function destroy(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo = Database::get();
        $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$params['id']]);
        Response::success(null, 'Category deleted.');
    }

    public function reorder(): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $body = Request::body();
        $pdo  = Database::get();

        foreach ($body['ids'] ?? [] as $order => $id) {
            $pdo->prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
                ->execute([$order, (int)$id]);
        }
        Response::success(null, 'Reordered.');
    }
}

// ─── BranchController ────────────────────────
class BranchController
{
    public function index(): void
    {
        $user = Auth::require();
        $pdo  = Database::get();

        $where  = ['b.deleted_at IS NULL'];
        $params = [];

        if ($user['role'] === 'super_admin') {
            // السوبر ادمن يشوف كل الفروع مع اسم المطعم
        } elseif ($user['role'] === 'owner') {
            $where[]  = 'b.restaurant_id = ?';
            $params[] = $user['restaurant_id'];
        } elseif (in_array($user['role'], ['manager', 'cashier', 'chef'])) {
            $where[]  = 'b.id = ?';
            $params[] = $user['branch_id'];
        }

        $whereStr = implode(' AND ', $where);
        $stmt = $pdo->prepare("
            SELECT b.*,
                   r.name  AS restaurant_name,
                   r.slug  AS restaurant_slug,
                   r.plan  AS restaurant_plan,
                   u.name  AS manager_name,
                   COUNT(DISTINCT usr.id) AS staff_count
            FROM branches b
            LEFT JOIN restaurants r ON r.id = b.restaurant_id
            LEFT JOIN users u ON u.id = b.manager_id
            LEFT JOIN users usr ON usr.branch_id = b.id
                AND usr.role NOT IN ('super_admin','owner','customer')
                AND usr.deleted_at IS NULL
            WHERE {$whereStr}
            GROUP BY b.id
            ORDER BY r.name ASC, b.name ASC
        ");
        $stmt->execute($params);

        $branches = $stmt->fetchAll();
        foreach ($branches as &$b) $b = $this->cast($b);

        Response::success($branches);
    }

    public function show(array $params): void
    {
        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            SELECT b.*,
                   r.name AS restaurant_name,
                   r.slug AS restaurant_slug,
                   r.branding,
                   r.logo AS restaurant_logo
            FROM branches b
            LEFT JOIN restaurants r ON r.id = b.restaurant_id
            WHERE (b.slug = ? OR b.id = ?) AND b.deleted_at IS NULL
        ");
        $stmt->execute([$params['slug'], $params['slug']]);
        $branch = $stmt->fetch();

        if (!$branch) Response::notFound('Branch not found.');
        // Normalize: include nested `restaurant` object with decoded branding and logo
        $rawLogo = $branch['restaurant_logo'] ?? null;
        // Normalize common mis-configured upload URL prefixes (development setups)
        if ($rawLogo && is_string($rawLogo)) {
            // replace legacy or incorrect prefixes with the actual uploads path
            $rawLogo = str_replace(
                [
                    'http://localhost/restory/backend/uploads/',
                    'http://localhost/restory/backend-ree/uploads/',
                ],
                'http://localhost/backend-ree/uploads/',
                $rawLogo
            );
        }

        $restaurant = [
            'id' => isset($branch['restaurant_id']) ? (int)$branch['restaurant_id'] : null,
            'name' => $branch['restaurant_name'] ?? null,
            'slug' => $branch['restaurant_slug'] ?? null,
            'branding' => jsonDecode($branch['branding'] ?? null),
            'logo' => $rawLogo,
        ];

        $branch['restaurant'] = $restaurant;
        // remove duplicate top-level restaurant fields to avoid confusion
        unset($branch['restaurant_name'], $branch['restaurant_slug'], $branch['branding'], $branch['restaurant_logo']);

        Response::success($this->cast($branch));
    }

    public function store(): void
    {
        Auth::requireRole(['super_admin', 'owner']);
        $data = Request::validate([
            'restaurant_id'   => 'required|integer',
            'name'            => 'required|max:150',
            'slug'            => '',          // الأدمن يحدده، وإلا بيتولد تلقائياً
            'address'         => 'required',
            'phone'           => '',
            'email'           => '',
            'currency'        => '',
            'currency_symbol' => '',
            'timezone'        => '',
            'manager_id'      => '',
        ]);

        $pdo = Database::get();

        // تحقق من عدد الفروع مقابل الـ plan
        $stmt = $pdo->prepare('SELECT max_branches FROM restaurants WHERE id = ?');
        $stmt->execute([$data['restaurant_id']]);
        $restaurant = $stmt->fetch();
        if (!$restaurant) Response::notFound('Restaurant not found.');

        $stmt = $pdo->prepare('SELECT COUNT(*) FROM branches WHERE restaurant_id = ? AND deleted_at IS NULL');
        $stmt->execute([$data['restaurant_id']]);
        $currentCount = (int)$stmt->fetchColumn();

        if ($currentCount >= (int)$restaurant['max_branches']) {
            Response::error("Branch limit reached ({$restaurant['max_branches']} branches max for this plan).", 422);
        }

        // الـ slug: إذا حدده الأدمن استخدمه، وإلا ولّده تلقائياً
        if (!empty($data['slug'])) {
            $slug = strtolower(trim(preg_replace('/[^a-z0-9-]/', '-', $data['slug']), '-'));
            // تحقق إنه فريد
            $stmt = $pdo->prepare('SELECT id FROM branches WHERE slug = ?');
            $stmt->execute([$slug]);
            if ($stmt->fetch()) Response::error('This slug is already taken. Choose another.', 422);
        } else {
            $slug = generateSlug($data['name'], 'branches');
        }

        $pdo->prepare("
            INSERT INTO branches
                (restaurant_id, manager_id, name, slug, address, phone, email,
                 currency, currency_symbol, timezone,
                 is_active, is_accepting_orders, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,1,1,?,?)
        ")->execute([
            $data['restaurant_id'],
            $data['manager_id'] ?: null,
            sanitize($data['name']),
            $slug,
            sanitize($data['address']),
            $data['phone']           ?: null,
            $data['email']           ?: null,
            $data['currency']        ?: 'SAR',
            $data['currency_symbol'] ?: '﷼',
            $data['timezone']        ?: 'Asia/Riyadh',
            now(), now(),
        ]);

        $id   = $pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT b.*, r.name AS restaurant_name FROM branches b LEFT JOIN restaurants r ON r.id=b.restaurant_id WHERE b.id = ?');
        $stmt->execute([$id]);

        Response::created($this->cast($stmt->fetch()), 'Branch created.');
    }

    public function update(array $params): void
    {
        $user = Auth::require();
        if (!Auth::canAccessBranch($user, (int)$params['id'])) Response::forbidden();

        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM branches WHERE id = ?');
        $stmt->execute([$params['id']]);
        $branch = $stmt->fetch();
        if (!$branch) Response::notFound();

        // إذا بدو يغيروا الـ slug، تحقق إنه فريد
        $slug = $branch['slug'];
        if (!empty($body['slug']) && $body['slug'] !== $branch['slug']) {
            $newSlug = strtolower(trim(preg_replace('/[^a-z0-9-]/', '-', $body['slug']), '-'));
            $check   = $pdo->prepare('SELECT id FROM branches WHERE slug = ? AND id != ?');
            $check->execute([$newSlug, $params['id']]);
            if ($check->fetch()) Response::error('This slug is already taken.', 422);
            $slug = $newSlug;
        }

        $pdo->prepare("
            UPDATE branches
            SET name=?, slug=?, address=?, phone=?, email=?,
                manager_id=?,
                is_active=?, is_accepting_orders=?,
                opening_hours=?, settings=?, updated_at=?
            WHERE id=?
        ")->execute([
            sanitize($body['name']    ?? $branch['name']),
            $slug,
            sanitize($body['address'] ?? $branch['address']),
            $body['phone']      ?? $branch['phone'],
            $body['email']      ?? $branch['email'],
            $body['manager_id'] ?? $branch['manager_id'],
            isset($body['is_active'])           ? (int)$body['is_active']           : $branch['is_active'],
            isset($body['is_accepting_orders']) ? (int)$body['is_accepting_orders'] : $branch['is_accepting_orders'],
            isset($body['opening_hours']) ? json_encode($body['opening_hours']) : $branch['opening_hours'],
            isset($body['settings'])      ? json_encode($body['settings'])      : $branch['settings'],
            now(), $params['id'],
        ]);

        $stmt = $pdo->prepare('SELECT b.*, r.name AS restaurant_name FROM branches b LEFT JOIN restaurants r ON r.id=b.restaurant_id WHERE b.id = ?');
        $stmt->execute([$params['id']]);
        Response::success($this->cast($stmt->fetch()));
    }

    public function destroy(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo = Database::get();

        $stmt = $pdo->prepare('SELECT id FROM branches WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) Response::notFound('Branch not found.');

        $pdo->prepare('UPDATE branches SET deleted_at = ?, updated_at = ? WHERE id = ?')
            ->execute([now(), now(), $params['id']]);

        Response::success(null, 'Branch deleted.');
    }

    public function toggle(array $params): void
    {
        $user = Auth::require();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM branches WHERE id = ?');
        $stmt->execute([$params['id']]);
        $branch = $stmt->fetch();
        if (!$branch) Response::notFound();

        // toggle الـ is_active (مش is_accepting_orders)
        $new = $branch['is_active'] ? 0 : 1;
        $pdo->prepare('UPDATE branches SET is_active = ?, updated_at = ? WHERE id = ?')
            ->execute([$new, now(), $params['id']]);

        Response::success(['is_active' => (bool)$new]);
    }

    private function cast(array $b): array
    {
        $b['id']                  = (int)$b['id'];
        $b['restaurant_id']       = (int)$b['restaurant_id'];
        $b['manager_id']          = $b['manager_id'] ? (int)$b['manager_id'] : null;
        $b['is_active']           = (bool)$b['is_active'];
        $b['is_accepting_orders'] = (bool)$b['is_accepting_orders'];
        $b['opening_hours']       = jsonDecode($b['opening_hours'] ?? null);
        $b['settings']            = jsonDecode($b['settings'] ?? null);
        $b['staff_count']         = isset($b['staff_count']) ? (int)$b['staff_count'] : 0;
        return $b;
    }
}

// ─── CouponController ────────────────────────
class CouponController
{
    public function index(): void
    {
        $user     = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int) Request::query('branch_id');
        if (!$branchId) Response::error('branch_id is required.', 422);
        if (!Auth::canAccessBranch($user, $branchId)) Response::forbidden();

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE branch_id = ? AND deleted_at IS NULL ORDER BY created_at DESC');
        $stmt->execute([$branchId]);

        Response::success($stmt->fetchAll());
    }

    public function validate(): void
    {
        $data = Request::validate([
            'code'         => 'required',
            'branch_id'    => 'required|integer',
            'order_amount' => 'required|numeric',
        ]);

        if (!rateLimit('coupon_validate:' . Request::ip(), 20, 60)) {
            Response::error('Too many attempts. Please wait.', 429);
        }

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE code = ? AND branch_id = ? AND deleted_at IS NULL');
        $stmt->execute([strtoupper(trim($data['code'])), $data['branch_id']]);
        $coupon = $stmt->fetch();

        if (!$coupon) Response::notFound('Coupon not found.');

        if (!isCouponValid($coupon, (float)$data['order_amount'])) {
            $reason = !$coupon['is_active']
                ? 'This coupon is no longer active.'
                : ($coupon['expires_at'] && strtotime($coupon['expires_at']) < time()
                    ? 'This coupon has expired.'
                    : ((float)$data['order_amount'] < (float)$coupon['min_order_amount']
                        ? "Minimum order is {$coupon['min_order_amount']}."
                        : 'Usage limit reached.'));
            Response::error($reason, 422);
        }

        $discount                      = calcDiscount($coupon, (float)$data['order_amount']);
        $coupon['calculated_discount'] = $discount;

        Response::success($coupon, "Coupon applied! You save {$discount}.");
    }

    public function store(): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $data = Request::validate([
            'branch_id'        => 'required|integer',
            'code'             => 'required|max:30',
            'type'             => 'required|in:percentage,fixed',
            'value'            => 'required|numeric',
            'min_order_amount' => '',
            'max_discount'     => '',
            'usage_limit'      => '',
            'description'      => '',
            'starts_at'        => '',
            'expires_at'       => '',
        ]);

        if (!Auth::canAccessBranch($user, (int)$data['branch_id'])) Response::forbidden();

        $code = strtoupper(sanitize($data['code']));
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT id FROM coupons WHERE code = ?');
        $stmt->execute([$code]);
        if ($stmt->fetch()) Response::error('Coupon code already exists.', 422);

        $pdo->prepare("
            INSERT INTO coupons
                (branch_id, code, type, value, min_order_amount, max_discount,
                 usage_limit, used_count, is_active, description, starts_at, expires_at,
                 created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,0,1,?,?,?,?,?)
        ")->execute([
            $data['branch_id'], $code, $data['type'], (float)$data['value'],
            (float)($data['min_order_amount'] ?? 0),
            $data['max_discount'] ?: null,
            $data['usage_limit']  ?: null,
            sanitize($data['description'] ?? ''),
            $data['starts_at'] ?: null,
            $data['expires_at'] ?: null,
            now(), now(),
        ]);

        $id   = $pdo->lastInsertId();
        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE id = ?');
        $stmt->execute([$id]);

        Response::created($stmt->fetch(), 'Coupon created.');
    }

    public function update(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE id = ?');
        $stmt->execute([$params['id']]);
        $coupon = $stmt->fetch();
        if (!$coupon) Response::notFound();

        $pdo->prepare("
            UPDATE coupons
            SET type=?,value=?,min_order_amount=?,max_discount=?,
                usage_limit=?,is_active=?,description=?,expires_at=?,updated_at=?
            WHERE id=?
        ")->execute([
            $body['type']        ?? $coupon['type'],
            isset($body['value']) ? (float)$body['value'] : $coupon['value'],
            isset($body['min_order_amount']) ? (float)$body['min_order_amount'] : $coupon['min_order_amount'],
            $body['max_discount'] ?? $coupon['max_discount'],
            $body['usage_limit']  ?? $coupon['usage_limit'],
            isset($body['is_active']) ? (int)$body['is_active'] : $coupon['is_active'],
            sanitize($body['description'] ?? $coupon['description']),
            $body['expires_at']  ?? $coupon['expires_at'],
            now(), $params['id'],
        ]);

        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE id = ?');
        $stmt->execute([$params['id']]);
        Response::success($stmt->fetch());
    }

    public function destroy(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo = Database::get();
        $pdo->prepare('UPDATE coupons SET deleted_at = ? WHERE id = ?')->execute([now(), $params['id']]);
        Response::success(null, 'Coupon deleted.');
    }
}