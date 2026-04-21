<?php

class Auth
{
    private static string $secret;
    private static int $expire;

    private static function init(): void
    {
        $cfg = require __DIR__ . '/../config/app.php';
        self::$secret = $cfg['jwt_secret'];
        self::$expire = $cfg['jwt_expire'];
    }

    // ─── Generate JWT ─────────────────────────
    public static function generateToken(array $payload): string
    {
        self::init();

        $header  = self::base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + self::$expire;
        $claims  = self::base64url(json_encode($payload));
        $sig     = self::base64url(hash_hmac('sha256', "$header.$claims", self::$secret, true));

        return "$header.$claims.$sig";
    }

    // ─── Verify + Decode JWT ──────────────────
    public static function verifyToken(string $token): ?array
    {
        self::init();

        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $claims, $sig] = $parts;

        // Check signature
        $expected = self::base64url(hash_hmac('sha256', "$header.$claims", self::$secret, true));
        if (!hash_equals($expected, $sig)) return null;

        $payload = json_decode(self::base64urlDecode($claims), true);
        if (!$payload) return null;

        // Check expiry
        if (isset($payload['exp']) && $payload['exp'] < time()) return null;

        return $payload;
    }

    // ─── Get current authenticated user ──────
    public static function user(): ?array
    {
        $token = Request::bearerToken();
        if (!$token) return null;

        $payload = self::verifyToken($token);
        if (!$payload || empty($payload['user_id'])) return null;

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    // ─── Require auth — abort if not ─────────
    public static function require(): array
    {
        $user = self::user();
        if (!$user) {
            Response::unauthorized('Authentication required. Please login.');
            exit;
        }
        return $user;
    }

    // ─── Role check ───────────────────────────
    public static function requireRole(array $roles): array
    {
        $user = self::require();
        if (!in_array($user['role'], $roles)) {
            Response::forbidden('You do not have permission to perform this action.');
            exit;
        }
        return $user;
    }

    // ─── Branch access check ──────────────────
    public static function canAccessBranch(array $user, int $branchId): bool
    {
        if ($user['role'] === 'super_admin') return true;

        if ($user['role'] === 'owner') {
            $pdo  = Database::get();
            $stmt = $pdo->prepare('SELECT id FROM branches WHERE id = ? AND restaurant_id = (SELECT restaurant_id FROM users WHERE id = ?)');
            $stmt->execute([$branchId, $user['id']]);
            return (bool) $stmt->fetch();
        }

        return (int)$user['branch_id'] === $branchId;
    }

    // ─── Password helpers ─────────────────────
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    // ─── Encryption for sensitive data ────────
    public static function encrypt(string $value): string
    {
        $cfg    = require __DIR__ . '/../config/app.php';
        $key    = substr(hash('sha256', $cfg['encrypt_key'], true), 0, 32);
        $iv     = random_bytes(16);
        $cipher = openssl_encrypt($value, 'AES-256-CBC', $key, 0, $iv);
        return base64_encode($iv . $cipher);
    }

    public static function decrypt(string $value): string
    {
        $cfg    = require __DIR__ . '/../config/app.php';
        $key    = substr(hash('sha256', $cfg['encrypt_key'], true), 0, 32);
        $raw    = base64_decode($value);
        $iv     = substr($raw, 0, 16);
        $cipher = substr($raw, 16);
        return openssl_decrypt($cipher, 'AES-256-CBC', $key, 0, $iv) ?: '';
    }

    // ─── Helpers ──────────────────────────────
    private static function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64urlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }
}
