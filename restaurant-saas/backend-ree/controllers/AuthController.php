<?php

class AuthController
{
    // POST /auth/login
    public function login(): void
    {
   
        $data = Request::validate([
            'email'       => 'required|email',
            'password'    => 'required',
            'branch_slug' => '', // optional: allow branch-specific login
        ]);
    
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([strtolower(trim($data['email']))]);
        $user = $stmt->fetch();

        if (!$user || !Auth::verifyPassword(trim($data['password']),trim( $user['password']))) {
            Response::error('Invalid email or password.', 401);
        }

        if (!$user['is_active']) {
            Response::error('Your account has been deactivated. Contact support.', 403);
        }

        $branch = null;
        if (!empty($data['branch_slug'])) {
            $stmt = $pdo->prepare('SELECT * FROM branches WHERE slug = ? AND deleted_at IS NULL LIMIT 1');
            $stmt->execute([trim($data['branch_slug'])]);
            $branch = $stmt->fetch();
            if (!$branch) Response::notFound('Branch not found.');

            // Allow if user is explicitly assigned to the branch
            if (!empty($user['branch_id']) && (int)$user['branch_id'] === (int)$branch['id']) {
                // ok
            } elseif (!empty($user['restaurant_id']) && (int)$user['restaurant_id'] === (int)$branch['restaurant_id'] && $user['role'] === 'owner') {
                // restaurant owner can access branch
            } else {
                Response::forbidden('You are not associated with this branch.');
            }
        }

        // Update last login
        $pdo->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
            ->execute([now(), $user['id']]);

        $token = Auth::generateToken(['user_id' => $user['id'], 'role' => $user['role']]);

        $branchData = null;
        if ($branch) {
            $branchData = [
                'id' => (int)$branch['id'],
                'name' => $branch['name'],
                'slug' => $branch['slug'],
                'restaurant_id' => (int)$branch['restaurant_id'],
                'is_active' => (bool)$branch['is_active'],
            ];
        }

        $resp = ['token' => $token, 'user' => $this->formatUser($user)];
        if ($branchData) $resp['branch'] = $branchData;

        Response::success($resp);
    }

    // POST /auth/logout
    public function logout(): void
    {
        // JWT is stateless — client just discards the token
        Response::success(null, 'Logged out successfully.');
    }

    // GET /auth/me
    public function me(): void
    {
        $user = Auth::require();

        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $fresh = $stmt->fetch();

        Response::success($this->formatUser($fresh));
    }

    private function formatUser(array $user): array
    {
        $homePaths = [
            'super_admin' => '/admin',
            'owner'       => '/owner',
            'manager'     => '/manager',
            'cashier'     => '/cashier',
            'chef'        => '/chef',
        ];

        return [
            'id'            => (int) $user['id'],
            'name'          => $user['name'],
            'email'         => $user['email'],
            'role'          => $user['role'],
            'restaurant_id' => $user['restaurant_id'] ? (int)$user['restaurant_id'] : null,
            'branch_id'     => $user['branch_id']     ? (int)$user['branch_id']     : null,
            'phone'         => $user['phone'],
            'avatar'        => $user['avatar'],
            'is_active'     => (bool) $user['is_active'],
            'home_path'     => $homePaths[$user['role']] ?? '/',
            'last_login_at' => $user['last_login_at'],
            'created_at'    => $user['created_at'],
        ];
    }
}
