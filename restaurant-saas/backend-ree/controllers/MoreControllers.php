<?php

// ─── RestaurantController ─────────────────────
class RestaurantController
{
    public function index(): void
    {
        Auth::requireRole(['super_admin']);
        $pdo = Database::get();

        $search = Request::query('search');
        $plan   = Request::query('plan');
        $where  = ['r.deleted_at IS NULL'];
        $params = [];

        if ($search) {
            $where[]  = '(r.name LIKE ? OR r.slug LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
            $params[] = $like;
        }
        if ($plan) {
            $where[]  = 'r.plan = ?';
            $params[] = $plan;
        }

        $whereStr = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT r.*,
                   u.name  AS owner_name,
                   u.email AS owner_email,
                   u.phone AS owner_phone,
                   COUNT(DISTINCT b.id) AS branches_count,
                   COUNT(DISTINCT s.id) AS staff_count
            FROM restaurants r
            LEFT JOIN users u ON u.id = r.owner_id
            LEFT JOIN branches b ON b.restaurant_id = r.id AND b.deleted_at IS NULL
            LEFT JOIN users s ON s.restaurant_id = r.id
                AND s.role NOT IN ('super_admin','owner','customer')
                AND s.deleted_at IS NULL
            WHERE {$whereStr}
            GROUP BY r.id
            ORDER BY r.created_at DESC
        ");
        $stmt->execute($params);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) $r = $this->cast($r);

        Response::success($rows);
    }

    public function show(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner']);
        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            SELECT r.*,
                   u.name  AS owner_name,
                   u.email AS owner_email,
                   COUNT(DISTINCT b.id) AS branches_count
            FROM restaurants r
            LEFT JOIN users u ON u.id = r.owner_id
            LEFT JOIN branches b ON b.restaurant_id = r.id AND b.deleted_at IS NULL
            WHERE r.id = ? AND r.deleted_at IS NULL
            GROUP BY r.id
        ");
        $stmt->execute([$params['id']]);
        $restaurant = $stmt->fetch();

        if (!$restaurant) Response::notFound('Restaurant not found.');
        Response::success($this->cast($restaurant));
    }

    public function store(): void
    {
        Auth::requireRole(['super_admin']);
        $data = Request::validate([
            'owner_id'     => 'required|integer',
            'name'         => 'required|max:150',
            'slug'         => 'required|max:160',
            'description'  => '',
            'cuisine_type' => '',
            'plan'         => '',
            'max_branches' => '',
        ]);

        $slug = strtolower(trim(preg_replace('/[^a-z0-9-]/', '-', $data['slug']), '-'));
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT id FROM restaurants WHERE slug = ?');
        $stmt->execute([$slug]);
        if ($stmt->fetch()) Response::error('This slug is already taken.', 422);

        $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'owner'");
        $stmt->execute([$data['owner_id']]);
        if (!$stmt->fetch()) Response::error('Owner not found or user is not an owner.', 422);

        $plan        = $data['plan'] ?? 'trial';
        $maxBranches = (int)($data['max_branches'] ?? match($plan) {
            'trial'      => 1,
            'basic'      => 3,
            'pro'        => 10,
            'enterprise' => 99,
            default      => 1,
        });

        $pdo->prepare("
            INSERT INTO restaurants
                (owner_id, name, slug, description, cuisine_type, plan, max_branches,
                 branding, is_active, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,1,?,?)
        ")->execute([
            $data['owner_id'],
            sanitize($data['name']),
            $slug,
            sanitize($data['description'] ?? ''),
            sanitize($data['cuisine_type'] ?? ''),
            $plan,
            $maxBranches,
            json_encode(['theme' => 'dark', 'primary_color' => '#f97316']),
            now(), now(),
        ]);

        $id = $pdo->lastInsertId();
        $pdo->prepare('UPDATE users SET restaurant_id = ? WHERE id = ?')
            ->execute([$id, $data['owner_id']]);

        $stmt = $pdo->prepare('SELECT r.*, u.name AS owner_name FROM restaurants r LEFT JOIN users u ON u.id=r.owner_id WHERE r.id = ?');
        $stmt->execute([$id]);

        Response::created($this->cast($stmt->fetch()), 'Restaurant created.');
    }

    public function update(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM restaurants WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $restaurant = $stmt->fetch();
        if (!$restaurant) Response::notFound();

        $slug = $restaurant['slug'];
        if (!empty($body['slug']) && $body['slug'] !== $restaurant['slug']) {
            $newSlug = strtolower(trim(preg_replace('/[^a-z0-9-]/', '-', $body['slug']), '-'));
            $check   = $pdo->prepare('SELECT id FROM restaurants WHERE slug = ? AND id != ?');
            $check->execute([$newSlug, $params['id']]);
            if ($check->fetch()) Response::error('This slug is already taken.', 422);
            $slug = $newSlug;
        }

        $newOwnerId = $body['owner_id'] ?? $restaurant['owner_id'];
        if ((int)$newOwnerId !== (int)$restaurant['owner_id']) {
            $pdo->prepare('UPDATE users SET restaurant_id = NULL WHERE id = ? AND role = ?')
                ->execute([$restaurant['owner_id'], 'owner']);
            $pdo->prepare('UPDATE users SET restaurant_id = ? WHERE id = ?')
                ->execute([$params['id'], $newOwnerId]);
        }

        $plan        = $body['plan'] ?? $restaurant['plan'];
        $maxBranches = isset($body['max_branches'])
            ? (int)$body['max_branches']
            : (int)$restaurant['max_branches'];

        $pdo->prepare("
            UPDATE restaurants
            SET owner_id=?, name=?, slug=?, description=?,
                cuisine_type=?, plan=?, max_branches=?,
                is_active=?, notes=?, updated_at=?
            WHERE id=?
        ")->execute([
            $newOwnerId,
            sanitize($body['name']         ?? $restaurant['name']),
            $slug,
            sanitize($body['description']  ?? $restaurant['description']),
            sanitize($body['cuisine_type'] ?? $restaurant['cuisine_type']),
            $plan,
            $maxBranches,
            isset($body['is_active']) ? (int)$body['is_active'] : $restaurant['is_active'],
            sanitize($body['notes'] ?? $restaurant['notes']),
            now(), $params['id'],
        ]);

        $stmt = $pdo->prepare('SELECT r.*, u.name AS owner_name FROM restaurants r LEFT JOIN users u ON u.id=r.owner_id WHERE r.id = ?');
        $stmt->execute([$params['id']]);
        Response::success($this->cast($stmt->fetch()));
    }

    public function destroy(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo = Database::get();

        $stmt = $pdo->prepare('SELECT id FROM restaurants WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) Response::notFound();

        $pdo->prepare('UPDATE restaurants SET deleted_at = ?, updated_at = ? WHERE id = ?')
            ->execute([now(), now(), $params['id']]);
        $pdo->prepare('UPDATE branches SET deleted_at = ?, updated_at = ? WHERE restaurant_id = ?')
            ->execute([now(), now(), $params['id']]);

        Response::success(null, 'Restaurant deleted.');
    }

    public function toggle(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT is_active FROM restaurants WHERE id = ?');
        $stmt->execute([$params['id']]);
        $r = $stmt->fetch();
        if (!$r) Response::notFound();

        $new = $r['is_active'] ? 0 : 1;
        $pdo->prepare('UPDATE restaurants SET is_active = ?, updated_at = ? WHERE id = ?')
            ->execute([$new, now(), $params['id']]);

        Response::success(['is_active' => (bool)$new]);
    }

    private function cast(array $r): array
    {
        $r['id']             = (int)$r['id'];
        $r['owner_id']       = (int)$r['owner_id'];
        $r['max_branches']   = (int)$r['max_branches'];
        $r['is_active']      = (bool)$r['is_active'];
        $r['branches_count'] = isset($r['branches_count']) ? (int)$r['branches_count'] : 0;
        $r['staff_count']    = isset($r['staff_count'])    ? (int)$r['staff_count']    : 0;
        $r['branding']       = jsonDecode($r['branding'] ?? null);
        return $r;
    }
}

// ─── AdminController ──────────────────────────
class AdminController
{
    public function overview(): void
    {
        Auth::requireRole(['super_admin']);
        $pdo = Database::get();

        $overview = $pdo->query('SELECT * FROM platform_overview')->fetch();

        $stmt = $pdo->query("
            SELECT o.id, o.order_number, o.status, o.total, o.created_at,
                   o.customer_name, b.name AS branch_name, r.name AS restaurant_name
            FROM orders o
            LEFT JOIN branches b ON b.id = o.branch_id
            LEFT JOIN restaurants r ON r.id = b.restaurant_id
            WHERE o.deleted_at IS NULL
            ORDER BY o.created_at DESC
            LIMIT 10
        ");
        $recentOrders = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT DATE(created_at) AS date,
                   COUNT(*) AS orders,
                   COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND status != 'cancelled' AND deleted_at IS NULL
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ");
        $revenueChart = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT r.id, r.name, r.slug, r.plan, r.is_active,
                   u.name AS owner_name,
                   COUNT(DISTINCT b.id) AS branches_count,
                   COUNT(DISTINCT o.id) AS orders_today
            FROM restaurants r
            LEFT JOIN users u ON u.id = r.owner_id
            LEFT JOIN branches b ON b.restaurant_id = r.id AND b.deleted_at IS NULL
            LEFT JOIN orders o ON o.branch_id = b.id AND DATE(o.created_at) = CURDATE()
            WHERE r.deleted_at IS NULL
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT 10
        ");
        $restaurants = $stmt->fetchAll();

        Response::success([
            'overview' => [
                'total_restaurants'  => (int)$overview['total_restaurants'],
                'active_restaurants' => (int)$overview['active_restaurants'],
                'total_branches'     => (int)$overview['total_branches'],
                'active_branches'    => (int)$overview['active_branches'],
                'total_staff'        => (int)$overview['total_staff'],
                'orders_today'       => (int)$overview['orders_today'],
                'revenue_today'      => round((float)$overview['revenue_today'], 2),
                'pending_orders'     => (int)$overview['pending_orders'],
            ],
            'recent_orders' => $recentOrders,
            'revenue_chart' => $revenueChart,
            'restaurants'   => $restaurants,
        ]);
    }
}

// ─── UserController ───────────────────────────
class UserController
{
    public function index(): void
    {
        $user   = Auth::require();
        $pdo    = Database::get();
        $where  = ["u.deleted_at IS NULL AND u.role != 'super_admin'"];
        $params = [];

        if ($user['role'] === 'owner') {
            $where[]  = 'u.restaurant_id = ?';
            $params[] = $user['restaurant_id'];
        } elseif ($user['role'] === 'manager') {
            $where[]  = 'u.branch_id = ?';
            $params[] = $user['branch_id'];
            $where[]  = "u.role IN ('cashier','chef')";
        } elseif ($user['role'] !== 'super_admin') {
            Response::forbidden();
        }

        if ($role = Request::query('role')) {
            $where[]  = 'u.role = ?';
            $params[] = $role;
        }
        if ($bid = Request::query('branch_id')) {
            $where[]  = 'u.branch_id = ?';
            $params[] = (int)$bid;
        }
        if ($rid = Request::query('restaurant_id')) {
            $where[]  = 'u.restaurant_id = ?';
            $params[] = (int)$rid;
        }
        if ($s = Request::query('search')) {
            $where[]  = '(u.name LIKE ? OR u.email LIKE ?)';
            $like     = "%{$s}%";
            $params[] = $like;
            $params[] = $like;
        }

        $whereStr = implode(' AND ', $where);
        $perPage  = (int)(Request::query('per_page') ?? 30);
        $page     = (int)(Request::query('page') ?? 1);
        $offset   = ($page - 1) * $perPage;

        $count = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$whereStr}");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.email, u.role,
                   u.restaurant_id, u.branch_id,
                   u.phone, u.avatar, u.is_active,
                   u.last_login_at, u.created_at,
                   b.name AS branch_name,
                   r.name AS restaurant_name
            FROM users u
            LEFT JOIN branches b ON b.id = u.branch_id
            LEFT JOIN restaurants r ON r.id = u.restaurant_id
            WHERE {$whereStr}
            ORDER BY u.name
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);

        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['id']        = (int)$u['id'];
            $u['is_active'] = (bool)$u['is_active'];
        }

        Response::paginated($users, $total, $page, $perPage);
    }

    public function store(): void
    {
        $me   = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $data = Request::validate([
            'name'          => 'required|max:100',
            'email'         => 'required|email',
            'password'      => 'required|min:8',
            'role'          => 'required|in:owner,manager,cashier,chef,customer',
            'restaurant_id' => '',
            'branch_id'     => '',
            'phone'         => '',
        ]);

        if ($me['role'] === 'manager' && !in_array($data['role'], ['cashier', 'chef'])) {
            Response::forbidden('Managers can only create cashiers or chefs.');
        }

        $pdo   = Database::get();
        $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $check->execute([strtolower($data['email'])]);
        if ($check->fetch()) Response::error('Email already in use.', 422);

        $pdo->prepare("
            INSERT INTO users
                (name, email, password, role, restaurant_id, branch_id, phone, is_active, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,1,?,?)
        ")->execute([
            sanitize($data['name']),
            strtolower($data['email']),
            Auth::hashPassword($data['password']),
            $data['role'],
            $data['restaurant_id'] ?: null,
            $data['branch_id']     ?: null,
            $data['phone']         ?: null,
            now(), now(),
        ]);

        $id   = $pdo->lastInsertId();
        $stmt = $pdo->prepare("
            SELECT u.*, b.name AS branch_name, r.name AS restaurant_name
            FROM users u
            LEFT JOIN branches b ON b.id = u.branch_id
            LEFT JOIN restaurants r ON r.id = u.restaurant_id
            WHERE u.id = ?
        ");
        $stmt->execute([$id]);

        Response::created($stmt->fetch(), 'User created.');
    }

    public function update(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$params['id']]);
        $user = $stmt->fetch();
        if (!$user) Response::notFound();

        $password = !empty($body['password'])
            ? Auth::hashPassword($body['password'])
            : $user['password'];

        $pdo->prepare("
            UPDATE users
            SET name=?, email=?, password=?, role=?,
                restaurant_id=?, branch_id=?, phone=?,
                is_active=?, updated_at=?
            WHERE id=?
        ")->execute([
            sanitize($body['name']  ?? $user['name']),
            strtolower($body['email'] ?? $user['email']),
            $password,
            $body['role']          ?? $user['role'],
            $body['restaurant_id'] ?? $user['restaurant_id'],
            $body['branch_id']     ?? $user['branch_id'],
            $body['phone']         ?? $user['phone'],
            isset($body['is_active']) ? (int)$body['is_active'] : $user['is_active'],
            now(), $params['id'],
        ]);

        $stmt = $pdo->prepare("
            SELECT u.*, b.name AS branch_name, r.name AS restaurant_name
            FROM users u
            LEFT JOIN branches b ON b.id = u.branch_id
            LEFT JOIN restaurants r ON r.id = u.restaurant_id
            WHERE u.id = ?
        ");
        $stmt->execute([$params['id']]);
        Response::success($stmt->fetch());
    }

    public function destroy(array $params): void
    {
        $me = Auth::requireRole(['super_admin', 'owner']);
        if ((int)$params['id'] === (int)$me['id']) {
            Response::error('Cannot delete yourself.', 422);
        }
        $pdo = Database::get();
        $pdo->prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?')
            ->execute([now(), now(), $params['id']]);
        Response::success(null, 'User deleted.');
    }

    public function toggle(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT is_active FROM users WHERE id = ?');
        $stmt->execute([$params['id']]);
        $user = $stmt->fetch();
        if (!$user) Response::notFound();

        $new = $user['is_active'] ? 0 : 1;
        $pdo->prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?')
            ->execute([$new, now(), $params['id']]);
        Response::success(['is_active' => (bool)$new]);
    }
}

// ─── GuestController ──────────────────────────
class GuestController
{
    public function init(): void
    {
        $data    = Request::validate(['branch_id' => 'required|integer']);
        $guestId = generateGuestId();
        $pdo     = Database::get();

        $pdo->prepare("
            INSERT INTO guest_sessions
                (branch_id, guest_id, ip_address, order_count, last_active_at, created_at, updated_at)
            VALUES (?,?,?,0,?,?,?)
        ")->execute([$data['branch_id'], $guestId, Request::ip(), now(), now(), now()]);

        Response::success(['guest_id' => $guestId]);
    }
}

// ─── AIController ─────────────────────────────
class AIController
{
    public function chat(): void
    {
        if (!rateLimit('ai_chat:' . Request::ip(), 40, 60)) {
            Response::error('Too many AI requests. Please wait.', 429);
        }

        $data = Request::validate([
            'branch_id' => 'required|integer',
            'message'   => 'required|max:500',
            'history'   => '',
        ]);

        $pdo = Database::get();

        $stmt = $pdo->prepare("
            SELECT p.name, p.price, p.description, p.allergens, p.calories,
                   p.is_featured, c.name AS cat
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.branch_id = ? AND p.status = 'active'
            ORDER BY p.sort_order
            LIMIT 60
        ");
        $stmt->execute([$data['branch_id']]);
        $products = $stmt->fetchAll();

        $stmt = $pdo->prepare('SELECT b.name, r.cuisine_type FROM branches b LEFT JOIN restaurants r ON r.id=b.restaurant_id WHERE b.id=?');
        $stmt->execute([$data['branch_id']]);
        $branch = $stmt->fetch();

        $stmt = $pdo->prepare("
            SELECT code, type, value, description FROM coupons
            WHERE branch_id=? AND is_active=1 AND deleted_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
        ");
        $stmt->execute([$data['branch_id']]);
        $coupons = $stmt->fetchAll();

        $grouped = [];
        foreach ($products as $p) {
            $grouped[$p['cat'] ?? 'Other'][] = "  - {$p['name']} ({$p['price']})" . ($p['description'] ? ": {$p['description']}" : '');
        }
        $menuText = '';
        foreach ($grouped as $cat => $items) {
            $menuText .= "{$cat}:\n" . implode("\n", $items) . "\n\n";
        }

        $offersText = implode("\n", array_map(
            fn($c) => "- {$c['code']}: " . ($c['type'] === 'percentage' ? "{$c['value']}% off" : "{$c['value']} off") . " — {$c['description']}",
            $coupons
        ));

        $cfg = require __DIR__ . '/../config/app.php';

        if (empty($cfg['openai_key'])) {
            $reply = $this->ruleBasedReply($data['message'], $products, $coupons);
            Response::success([
                'reply'         => $reply,
                'products'      => array_slice($products, 0, 3),
                'quick_replies' => ["What's popular? 🔥", "Show me offers 🏷️", "I have an allergy ⚠️"],
            ]);
            return;
        }

        $systemPrompt = "You are an AI waiter for \"{$branch['name']}\", a {$branch['cuisine_type']} restaurant.\nOnly discuss this restaurant's menu and offers.\n\nMENU:\n{$menuText}\nACTIVE OFFERS:\n{$offersText}\n\nBe warm and concise (2-3 sentences). Use emojis sparingly.";
        $history      = is_array($data['history']) ? array_slice($data['history'], -10) : [];
        $messages     = [['role' => 'system', 'content' => $systemPrompt]];
        foreach ($history as $h) {
            if (!empty($h['role']) && !empty($h['content'])) {
                $messages[] = ['role' => $h['role'], 'content' => $h['content']];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $data['message']];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$cfg['openai_key']}"],
            CURLOPT_POSTFIELDS     => json_encode(['model' => $cfg['openai_model'], 'messages' => $messages, 'max_tokens' => 300, 'temperature' => 0.7]),
            CURLOPT_TIMEOUT        => 15,
        ]);
        $resp = curl_exec($ch);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($err || !$resp) {
            Response::success(['reply' => "I'm having a moment — please try again! 😅", 'products' => [], 'quick_replies' => []]);
        }

        $json      = json_decode($resp, true);
        $reply     = $json['choices'][0]['message']['content'] ?? "Can I help you find something on the menu?";
        $suggested = array_filter($products, fn($p) => stripos($reply, $p['name']) !== false);
        if (empty($suggested)) $suggested = array_filter($products, fn($p) => !empty($p['is_featured']));

        Response::success([
            'reply'         => $reply,
            'products'      => array_values(array_slice($suggested, 0, 3)),
            'quick_replies' => ["Show me the menu 📋", "What's popular? 🔥", "Any specials? 🌟"],
        ]);
    }

    private function ruleBasedReply(string $msg, array $products, array $coupons): string
    {
        $lower = strtolower($msg);

        if (str_contains($lower, 'offer') || str_contains($lower, 'discount') || str_contains($lower, 'coupon')) {
            if (empty($coupons)) return "No active offers right now, but check back soon! 🌟";
            $list = implode(', ', array_map(fn($c) => "{$c['code']} ({$c['description']})", $coupons));
            return "🎉 Active offers: {$list}. Apply at checkout!";
        }
        if (str_contains($lower, 'popular') || str_contains($lower, 'recommend') || str_contains($lower, 'best')) {
            $featured = array_filter($products, fn($p) => !empty($p['is_featured']));
            if (!empty($featured)) {
                $names = implode(', ', array_map(fn($p) => $p['name'], array_slice($featured, 0, 3)));
                return "Our most loved dishes: {$names} ⭐. Shall I add one to your cart?";
            }
        }
        if (str_contains($lower, 'allerg') || str_contains($lower, 'gluten') || str_contains($lower, 'nut')) {
            return "Each product shows allergen info. Look for the ⚠️ badge, or ask me about a specific dish! 🌿";
        }

        $names = implode(', ', array_map(fn($p) => $p['name'], array_slice($products, 0, 3)));
        return "Welcome! 👋 Try our {$names}, or tell me what you're in the mood for!";
    }
}

// ─── BrandingController ───────────────────────
class BrandingController
{
    public function show(array $params): void
    {
        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT branding FROM restaurants WHERE id = ?');
        $stmt->execute([$params['id']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound();
        Response::success(jsonDecode($row['branding']));
    }

    public function update(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner']);
        $body = Request::body();
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT branding FROM restaurants WHERE id = ?');
        $stmt->execute([$params['id']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound();

        $allowed = ['theme', 'primary_color', 'font_display', 'font_body', 'custom_css', 'tagline', 'about_text', 'contact_email', 'contact_phone'];
        $current = jsonDecode($row['branding']);

        foreach ($allowed as $key) {
            if (isset($body[$key])) $current[$key] = sanitize($body[$key]);
        }

        $pdo->prepare('UPDATE restaurants SET branding = ?, updated_at = ? WHERE id = ?')
            ->execute([json_encode($current), now(), $params['id']]);

        Response::success($current, 'Branding updated.');
    }

    public function uploadLogo(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner']);
        if (empty($_FILES['logo']['name'])) Response::error('No file uploaded.', 422);

        $url = uploadFile($_FILES['logo'], 'logos');
        if (!$url) Response::error('Failed to upload logo.', 422);

        $pdo = Database::get();
        $pdo->prepare('UPDATE restaurants SET logo = ?, updated_at = ? WHERE id = ?')
            ->execute([$url, now(), $params['id']]);

        Response::success(['logo_url' => $url]);
    }
}

// ─── AnalyticsController ──────────────────────
class AnalyticsController
{
    public function overview(): void
    {
        $user     = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int)Request::query('branch_id');
        $period   = Request::query('period') ?? 'week';
        $pdo      = Database::get();

        [$dateFrom, $dateTo, $prevFrom, $prevTo] = $this->periodDates($period);

        $stmt = $pdo->prepare("
            SELECT
                COUNT(*)                                                    AS total_orders,
                COALESCE(SUM(total), 0)                                     AS total_revenue,
                COALESCE(AVG(total), 0)                                     AS avg_order_value,
                COUNT(DISTINCT COALESCE(user_id, guest_id))                 AS total_customers,
                SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END)            AS guest_orders,
                SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)        AS registered_orders
            FROM orders
            WHERE branch_id = ?
              AND created_at BETWEEN ? AND ?
              AND status != 'cancelled'
              AND deleted_at IS NULL
        ");
        $stmt->execute([$branchId, $dateFrom, $dateTo]);
        $current = $stmt->fetch();

        $stmt->execute([$branchId, $prevFrom, $prevTo]);
        $previous = $stmt->fetch();

        $revenueChange = $previous['total_revenue'] > 0
            ? round((($current['total_revenue'] - $previous['total_revenue']) / $previous['total_revenue']) * 100, 1)
            : 0;
        $ordersChange = $previous['total_orders'] > 0
            ? round((($current['total_orders'] - $previous['total_orders']) / $previous['total_orders']) * 100, 1)
            : 0;

        // New vs Returning customers (simplified)
        $stmt = $pdo->prepare("
            SELECT
                COUNT(DISTINCT CASE WHEN order_count = 1 THEN gs.guest_id END) AS new_customers,
                COUNT(DISTINCT CASE WHEN order_count > 1 THEN gs.guest_id END) AS returning_customers
            FROM guest_sessions gs
            WHERE gs.branch_id = ?
        ");
        $stmt->execute([$branchId]);
        $customerStats = $stmt->fetch();

        Response::success([
            'total_revenue'      => round((float)$current['total_revenue'], 2),
            'total_orders'       => (int)$current['total_orders'],
            'avg_order_value'    => round((float)$current['avg_order_value'], 2),
            'total_customers'    => (int)$current['total_customers'],
            'guest_orders'       => (int)$current['guest_orders'],
            'registered_orders'  => (int)$current['registered_orders'],
            'new_customers'      => (int)($customerStats['new_customers'] ?? 0),
            'returning_customers'=> (int)($customerStats['returning_customers'] ?? 0),
            'comparison'         => [
                'revenue_change' => $revenueChange,
                'orders_change'  => $ordersChange,
            ],
        ]);
    }

    public function revenue(): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int)Request::query('branch_id');
        $period   = Request::query('period') ?? 'week';
        $pdo      = Database::get();

        [$dateFrom, $dateTo] = $this->periodDates($period);

        $groupBy = match($period) {
            'day'   => "DATE_FORMAT(created_at, '%H:00')",
            'year'  => "DATE_FORMAT(created_at, '%Y-%m')",
            default => 'DATE(created_at)',
        };

        $stmt = $pdo->prepare("
            SELECT {$groupBy} AS date,
                   COUNT(*) AS orders,
                   COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE branch_id = ?
              AND created_at BETWEEN ? AND ?
              AND status != 'cancelled'
              AND deleted_at IS NULL
            GROUP BY {$groupBy}
            ORDER BY date ASC
        ");
        $stmt->execute([$branchId, $dateFrom, $dateTo]);

        Response::success($stmt->fetchAll());
    }

    public function products(): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int)Request::query('branch_id');
        $pdo      = Database::get();

        $stmt = $pdo->prepare("
            SELECT
                oi.product_id,
                oi.product_name,
                p.image AS product_image,
                COUNT(*) AS total_orders,
                SUM(oi.quantity) AS total_quantity,
                COALESCE(SUM(oi.total_price), 0) AS total_revenue
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.branch_id = ?
            GROUP BY oi.product_id, oi.product_name, p.image
            ORDER BY total_orders DESC
            LIMIT 20
        ");
        $stmt->execute([$branchId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['total_orders']   = (int)$r['total_orders'];
            $r['total_quantity'] = (int)$r['total_quantity'];
            $r['total_revenue']  = round((float)$r['total_revenue'], 2);
        }

        Response::success($rows);
    }

    public function heatmap(): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int)Request::query('branch_id');
        $pdo      = Database::get();

        $stmt = $pdo->prepare("
            SELECT
                DAYOFWEEK(created_at) - 1 AS day,
                HOUR(created_at)          AS hour,
                COUNT(*)                  AS order_count
            FROM orders
            WHERE branch_id = ?
              AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
              AND status != 'cancelled'
              AND deleted_at IS NULL
            GROUP BY day, hour
            ORDER BY day, hour
        ");
        $stmt->execute([$branchId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['day']         = (int)$r['day'];
            $r['hour']        = (int)$r['hour'];
            $r['order_count'] = (int)$r['order_count'];
        }

        Response::success($rows);
    }

    public function discounts(): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $branchId = (int)Request::query('branch_id');
        $pdo      = Database::get();

        $stmt = $pdo->prepare("
            SELECT
                c.code AS coupon_code,
                c.type,
                c.value,
                COUNT(o.id)                    AS usage_count,
                COALESCE(SUM(o.discount), 0)   AS total_discount,
                COALESCE(SUM(o.total), 0)      AS revenue_generated
            FROM coupons c
            LEFT JOIN orders o ON o.coupon_id = c.id
                AND o.status != 'cancelled'
                AND o.deleted_at IS NULL
            WHERE c.branch_id = ?
            GROUP BY c.id, c.code, c.type, c.value
            ORDER BY usage_count DESC
        ");
        $stmt->execute([$branchId]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['usage_count']       = (int)$r['usage_count'];
            $r['total_discount']    = round((float)$r['total_discount'], 2);
            $r['revenue_generated'] = round((float)$r['revenue_generated'], 2);
        }

        Response::success($rows);
    }

    // ─── Helper ──────────────────────────────
    private function periodDates(string $period): array
    {
        $now = now();
        [$dateFrom, $dateTo, $prevFrom, $prevTo] = match($period) {
            'day'   => [
                date('Y-m-d 00:00:00'),
                date('Y-m-d 23:59:59'),
                date('Y-m-d 00:00:00', strtotime('-1 day')),
                date('Y-m-d 23:59:59', strtotime('-1 day')),
            ],
            'week'  => [
                date('Y-m-d 00:00:00', strtotime('-6 days')),
                date('Y-m-d 23:59:59'),
                date('Y-m-d 00:00:00', strtotime('-13 days')),
                date('Y-m-d 23:59:59', strtotime('-7 days')),
            ],
            'month' => [
                date('Y-m-01 00:00:00'),
                date('Y-m-d 23:59:59'),
                date('Y-m-01 00:00:00', strtotime('-1 month')),
                date('Y-m-t 23:59:59', strtotime('-1 month')),
            ],
            'year'  => [
                date('Y-01-01 00:00:00'),
                date('Y-12-31 23:59:59'),
                date('Y-01-01 00:00:00', strtotime('-1 year')),
                date('Y-12-31 23:59:59', strtotime('-1 year')),
            ],
            default => [
                date('Y-m-d 00:00:00', strtotime('-6 days')),
                date('Y-m-d 23:59:59'),
                date('Y-m-d 00:00:00', strtotime('-13 days')),
                date('Y-m-d 23:59:59', strtotime('-7 days')),
            ],
        };

        return [$dateFrom, $dateTo, $prevFrom, $prevTo];
    }
}

// ─── NotificationController ───────────────────
class NotificationController
{
    public function index(): void
    {
        $user = Auth::require();
        $pdo  = Database::get();

        $stmt = $pdo->prepare("
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        ");
        $stmt->execute([$user['id']]);
        $notifications = $stmt->fetchAll();

        $unread = array_filter($notifications, fn($n) => !$n['is_read']);

        Response::success([
            'notifications' => $notifications,
            'unread_count'  => count($unread),
        ]);
    }

    public function readAll(): void
    {
        $user = Auth::require();
        $pdo  = Database::get();

        $pdo->prepare("
            UPDATE notifications
            SET is_read = 1, read_at = ?
            WHERE user_id = ? AND is_read = 0
        ")->execute([now(), $user['id']]);

        Response::success(null, 'All notifications marked as read.');
    }

    public function read(array $params): void
    {
        $user = Auth::require();
        $pdo  = Database::get();

        $pdo->prepare("
            UPDATE notifications
            SET is_read = 1, read_at = ?
            WHERE id = ? AND user_id = ?
        ")->execute([now(), $params['id'], $user['id']]);

        Response::success(null, 'Notification marked as read.');
    }
}

// ─── SubscriptionController ───────────────────
class SubscriptionController
{
    public function index(): void
    {
        Auth::requireRole(['super_admin']);
        $pdo    = Database::get();
        $where  = ['1=1'];
        $params = [];

        if ($rid = Request::query('restaurant_id')) {
            $where[]  = 's.restaurant_id = ?';
            $params[] = (int)$rid;
        }

        if ($status = Request::query('status')) {
            $where[]  = 's.status = ?';
            $params[] = $status;
        }

        if (Request::query('expiring_soon')) {
            $where[] = 's.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)';
            $where[] = "s.status = 'active'";
        }

        $whereStr = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT s.*,
                   r.name        AS restaurant_name,
                   r.slug        AS restaurant_slug,
                   r.plan        AS restaurant_plan,
                   u.name        AS owner_name,
                   u.email       AS owner_email,
                   adm.name      AS created_by_name,
                   DATEDIFF(s.expires_at, NOW()) AS days_remaining
            FROM subscriptions s
            LEFT JOIN restaurants r ON r.id = s.restaurant_id
            LEFT JOIN users u ON u.id = r.owner_id
            LEFT JOIN users adm ON adm.id = s.created_by
            WHERE {$whereStr}
            ORDER BY s.expires_at ASC
        ");
        $stmt->execute($params);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) $row = $this->cast($row);

        Response::success($rows);
    }

    public function show(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            SELECT s.*,
                   r.name  AS restaurant_name,
                   u.name  AS owner_name,
                   u.email AS owner_email,
                   adm.name AS created_by_name,
                   DATEDIFF(s.expires_at, NOW()) AS days_remaining
            FROM subscriptions s
            LEFT JOIN restaurants r ON r.id = s.restaurant_id
            LEFT JOIN users u ON u.id = r.owner_id
            LEFT JOIN users adm ON adm.id = s.created_by
            WHERE s.id = ?
        ");
        $stmt->execute([$params['id']]);
        $sub = $stmt->fetch();

        if (!$sub) Response::notFound('Subscription not found.');
        Response::success($this->cast($sub));
    }

    public function store(): void
    {
        $admin = Auth::requireRole(['super_admin']);
        $data  = Request::validate([
            'restaurant_id'   => 'required|integer',
            'plan'            => 'required|in:trial,basic,pro,enterprise',
            'amount'          => 'required|numeric',
            'starts_at'       => '',
            'duration_months' => '',
            'notes'           => '',
            'currency'        => '',
        ]);

        $pdo = Database::get();

        $stmt = $pdo->prepare('SELECT id, name FROM restaurants WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$data['restaurant_id']]);
        if (!$stmt->fetch()) Response::notFound('Restaurant not found.');

        $pdo->prepare("
            UPDATE subscriptions
            SET status = 'cancelled', updated_at = ?
            WHERE restaurant_id = ? AND status = 'active'
        ")->execute([now(), $data['restaurant_id']]);

        $startsAt       = !empty($data['starts_at']) ? $data['starts_at'] : now();
        $durationMonths = (int)($data['duration_months'] ?? 12);
        $expiresAt      = date('Y-m-d H:i:s', strtotime("+{$durationMonths} months", strtotime($startsAt)));

        $pdo->prepare("
            INSERT INTO subscriptions
                (restaurant_id, plan, status, amount, currency,
                 starts_at, expires_at, notes, created_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $data['restaurant_id'],
            $data['plan'],
            'active',
            (float)$data['amount'],
            $data['currency'] ?? 'SAR',
            $startsAt,
            $expiresAt,
            sanitize($data['notes'] ?? ''),
            $admin['id'],
            now(), now(),
        ]);

        $id = $pdo->lastInsertId();

        $pdo->prepare('UPDATE restaurants SET plan = ?, is_active = 1, updated_at = ? WHERE id = ?')
            ->execute([$data['plan'], now(), $data['restaurant_id']]);

        $stmt = $pdo->prepare("
            SELECT s.*, r.name AS restaurant_name, u.name AS owner_name,
                   DATEDIFF(s.expires_at, NOW()) AS days_remaining
            FROM subscriptions s
            LEFT JOIN restaurants r ON r.id = s.restaurant_id
            LEFT JOIN users u ON u.id = r.owner_id
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);

        Response::created($this->cast($stmt->fetch()), 'Subscription created successfully.');
    }

    public function cancel(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM subscriptions WHERE id = ?');
        $stmt->execute([$params['id']]);
        $sub = $stmt->fetch();

        if (!$sub) Response::notFound('Subscription not found.');
        if ($sub['status'] !== 'active') Response::error('Subscription is not active.', 422);

        $pdo->prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?")
            ->execute([now(), $params['id']]);

        $pdo->prepare('UPDATE restaurants SET is_active = 0, updated_at = ? WHERE id = ?')
            ->execute([now(), $sub['restaurant_id']]);

        Response::success(null, 'Subscription cancelled. Restaurant has been deactivated.');
    }

    public function suspend(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM subscriptions WHERE id = ?');
        $stmt->execute([$params['id']]);
        $sub = $stmt->fetch();

        if (!$sub) Response::notFound();
        if ($sub['status'] !== 'active') Response::error('Only active subscriptions can be suspended.', 422);

        $pdo->prepare("UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE id = ?")
            ->execute([now(), $params['id']]);

        $pdo->prepare('UPDATE restaurants SET is_active = 0, updated_at = ? WHERE id = ?')
            ->execute([now(), $sub['restaurant_id']]);

        Response::success(null, 'Subscription suspended.');
    }

    public function reactivate(array $params): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM subscriptions WHERE id = ?');
        $stmt->execute([$params['id']]);
        $sub = $stmt->fetch();

        if (!$sub) Response::notFound();
        if (!in_array($sub['status'], ['suspended', 'expired'])) {
            Response::error('Only suspended or expired subscriptions can be reactivated.', 422);
        }

        if (strtotime($sub['expires_at']) < time()) {
            Response::error('Subscription has expired. Please create a new subscription.', 422);
        }

        $pdo->prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?")
            ->execute([now(), $params['id']]);

        $pdo->prepare('UPDATE restaurants SET is_active = 1, updated_at = ? WHERE id = ?')
            ->execute([now(), $sub['restaurant_id']]);

        Response::success(null, 'Subscription reactivated.');
    }

    public function expiring(): void
    {
        Auth::requireRole(['super_admin']);
        $pdo  = Database::get();
        $days = (int)(Request::query('days') ?? 30);

        $stmt = $pdo->prepare("
            SELECT s.*,
                   r.name  AS restaurant_name,
                   u.name  AS owner_name,
                   u.email AS owner_email,
                   DATEDIFF(s.expires_at, NOW()) AS days_remaining
            FROM subscriptions s
            LEFT JOIN restaurants r ON r.id = s.restaurant_id
            LEFT JOIN users u ON u.id = r.owner_id
            WHERE s.status = 'active'
              AND s.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
            ORDER BY s.expires_at ASC
        ");
        $stmt->execute([$days]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) $row = $this->cast($row);

        Response::success($rows);
    }

    private function cast(array $s): array
    {
        $s['id']               = (int)$s['id'];
        $s['restaurant_id']    = (int)$s['restaurant_id'];
        $s['amount']           = (float)$s['amount'];
        $s['days_remaining']   = isset($s['days_remaining']) ? (int)$s['days_remaining'] : null;
        $s['is_expired']       = isset($s['expires_at']) && strtotime($s['expires_at']) < time();
        $s['is_expiring_soon'] = isset($s['days_remaining']) && $s['days_remaining'] <= 30 && $s['days_remaining'] >= 0;
        return $s;
    }
}