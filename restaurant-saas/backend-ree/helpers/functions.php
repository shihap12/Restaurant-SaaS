<?php

// ─── Sanitize input ───────────────────────────
function sanitize(mixed $value): mixed
{
    if (is_string($value)) {
        return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
    }
    if (is_array($value)) {
        return array_map('sanitize', $value);
    }
    return $value;
}

// ─── Generate unique slug ─────────────────────
function generateSlug(string $text, string $table, string $column = 'slug'): string
{
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $text), '-'));
    $pdo  = Database::get();
    $base = $slug;
    $i    = 1;

    while (true) {
        $stmt = $pdo->prepare("SELECT id FROM {$table} WHERE {$column} = ?");
        $stmt->execute([$slug]);
        if (!$stmt->fetch()) break;
        $slug = $base . '-' . $i++;
    }

    return $slug;
}

// ─── Generate order number ────────────────────
function generateOrderNumber(int $branchId): string
{
    $pdo   = Database::get();
    $today = date('Ymd');
    // Start with today's count + 1, but ensure uniqueness to avoid race conditions
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE branch_id = ? AND DATE(created_at) = CURDATE()");
    $stmt->execute([$branchId]);
    $count = (int)$stmt->fetchColumn();

    $attempt = max(1, $count);
    do {
        $attempt++;
        $orderNumber = 'ORD' . $today . str_pad($attempt, 3, '0', STR_PAD_LEFT);
        $check = $pdo->prepare('SELECT id FROM orders WHERE order_number = ?');
        $check->execute([$orderNumber]);
        $exists = (bool)$check->fetch();
    } while ($exists);

    return $orderNumber;
}

// ─── Generate guest ID ────────────────────────
function generateGuestId(): string
{
    return 'guest_' . bin2hex(random_bytes(16));
}

// ─── Rate limiter (file-based, works on XAMPP) ─
function rateLimit(string $key, int $maxRequests, int $windowSeconds): bool
{
    $dir  = sys_get_temp_dir() . '/restory_rate/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $file = $dir . md5($key) . '.json';
    $now  = time();
    $data = file_exists($file) ? json_decode(file_get_contents($file), true) : ['count' => 0, 'reset' => $now + $windowSeconds];

    if ($now > $data['reset']) {
        $data = ['count' => 0, 'reset' => $now + $windowSeconds];
    }

    $data['count']++;
    file_put_contents($file, json_encode($data));

    return $data['count'] <= $maxRequests;
}

// ─── Upload file ──────────────────────────────
function uploadFile(array $file, string $folder): ?string
{
    $cfg       = require __DIR__ . '/../config/app.php';
    $allowed   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $maxSize   = $cfg['max_file_size'];

    if ($file['error'] !== UPLOAD_ERR_OK)      return null;
    if ($file['size'] > $maxSize)               return null;
    if (!in_array($file['type'], $allowed))     return null;

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('', true) . '.' . strtolower($ext);
    $dir      = $cfg['upload_path'] . $folder . '/';

    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $dest = $dir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) return null;

    return $cfg['upload_url'] . $folder . '/' . $filename;
}

// ─── Paginate a query ─────────────────────────
function paginate(string $sql, array $params, int $page, int $perPage, string $countSql = ''): array
{
    $pdo    = Database::get();
    $offset = ($page - 1) * $perPage;

    // Count total
    if ($countSql) {
        $stmt  = $pdo->prepare($countSql);
        $stmt->execute($params);
        $total = (int) $stmt->fetchColumn();
    } else {
        $countQuery = preg_replace('/SELECT .+? FROM/is', 'SELECT COUNT(*) FROM', $sql);
        $countQuery = preg_replace('/ORDER BY .+$/i', '', $countQuery);
        $stmt       = $pdo->prepare($countQuery);
        $stmt->execute($params);
        $total = (int) $stmt->fetchColumn();
    }

    // Fetch page
    $stmt = $pdo->prepare($sql . " LIMIT {$perPage} OFFSET {$offset}");
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    return compact('items', 'total');
}

// ─── Decode JSON column safely ────────────────
function jsonDecode(?string $value, mixed $default = []): mixed
{
    if ($value === null) return $default;
    $decoded = json_decode($value, true);
    return ($decoded !== null) ? $decoded : $default;
}

// ─── Current timestamp ────────────────────────
function now(): string
{
    return date('Y-m-d H:i:s');
}

// ─── Validate coupon ──────────────────────────
function isCouponValid(array $coupon, float $orderAmount): bool
{
    if (!$coupon['is_active']) return false;
    if ($coupon['starts_at'] && strtotime($coupon['starts_at']) > time()) return false;
    if ($coupon['expires_at'] && strtotime($coupon['expires_at']) < time()) return false;
    if ($coupon['usage_limit'] && $coupon['used_count'] >= $coupon['usage_limit']) return false;
    if ($orderAmount < $coupon['min_order_amount']) return false;
    return true;
}

function calcDiscount(array $coupon, float $orderAmount): float
{
    $discount = $coupon['type'] === 'percentage'
        ? $orderAmount * ($coupon['value'] / 100)
        : (float) $coupon['value'];

    if ($coupon['max_discount']) {
        $discount = min($discount, $coupon['max_discount']);
    }
    return round($discount, 2);
}
