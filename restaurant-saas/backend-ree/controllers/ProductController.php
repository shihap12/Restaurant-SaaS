<?php

class ProductController
{
    // GET /products?branch_id=&category_id=&search=&status=
    public function index(): void
    {
        $branchId = (int) Request::query('branch_id');
        if (!$branchId) Response::error('branch_id is required.', 422);

        $pdo    = Database::get();
        $where  = ['p.branch_id = ?'];
        $params = [$branchId];

        // Public users see only active products
        $user = Auth::user();
        if (!$user || in_array($user['role'], ['customer', 'guest'])) {
            $where[] = "p.status = 'active'";
        } elseif ($status = Request::query('status')) {
            $where[]  = 'p.status = ?';
            $params[] = $status;
        }

        if ($cat = Request::query('category_id')) {
            $where[]  = 'p.category_id = ?';
            $params[] = (int)$cat;
        }

        if ($search = Request::query('search')) {
            $where[]  = '(p.name LIKE ? OR p.name_ar LIKE ? OR p.description LIKE ?)';
            $like     = '%' . $search . '%';
            $params   = array_merge($params, [$like, $like, $like]);
        }

        if (Request::query('featured')) {
            $where[] = 'p.is_featured = 1';
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT p.*,
                       c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE {$whereStr}
                AND p.deleted_at IS NULL
                ORDER BY p.sort_order ASC, p.name ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        // Attach variants + addons
        foreach ($products as &$product) {
            $product = $this->attachRelations($pdo, $product);
        }

        Response::success($products);
    }

    // GET /products/:id
    public function show(array $params): void
    {
        $pdo  = Database::get();
        $stmt = $pdo->prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $product = $stmt->fetch();

        if (!$product) Response::notFound('Product not found.');

        Response::success($this->attachRelations($pdo, $product));
    }

    // POST /products
    public function store(): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager']);

        $data = Request::validate([
            'branch_id'        => 'required|integer',
            'restaurant_id'    => 'required|integer',
            'category_id'      => '',
            'name'             => 'required|max:255',
            'name_ar'          => '',
            'description'      => '',
            'description_ar'   => '',
            'price'            => 'required|numeric',
            'ingredients'      => '',
            'allergens'        => '',
            'status'           => 'in:active,inactive,out_of_stock',
            'is_featured'      => '',
            'is_new'           => '',
            'calories'         => '',
            'preparation_time' => '',
            'sort_order'       => '',
        ]);

        if (!Auth::canAccessBranch($user, (int)$data['branch_id'])) {
            Response::forbidden();
        }

        // Image upload
        $imageUrl = null;
        if (!empty($_FILES['image']['name'])) {
            $imageUrl = uploadFile($_FILES['image'], 'products');
        }

        $pdo  = Database::get();
        $stmt = $pdo->prepare("
            INSERT INTO products
            (branch_id, restaurant_id, category_id, name, name_ar, description, description_ar,
             price, image, ingredients, allergens, status, is_featured, is_new,
             calories, preparation_time, sort_order, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");

        $stmt->execute([
            $data['branch_id'],
            $data['restaurant_id'],
            $data['category_id'] ?: null,
            sanitize($data['name']),
            sanitize($data['name_ar'] ?? ''),
            sanitize($data['description'] ?? ''),
            sanitize($data['description_ar'] ?? ''),
            (float)$data['price'],
            $imageUrl,
            $data['ingredients'] ?? '[]',
            $data['allergens']   ?? '[]',
            $data['status']      ?? 'active',
            isset($data['is_featured']) ? (int)$data['is_featured'] : 0,
            isset($data['is_new'])      ? (int)$data['is_new']      : 0,
            $data['calories']          ?: null,
            $data['preparation_time']  ?: null,
            $data['sort_order']        ?? 0,
            now(), now(),
        ]);

        $id = (int)$pdo->lastInsertId();

        // Create stock entry
        $pdo->prepare("INSERT INTO stock_items (branch_id, product_id, quantity, min_threshold, unit, created_at, updated_at) VALUES (?,?,100,10,'piece',?,?)")
            ->execute([$data['branch_id'], $id, now(), now()]);

        $stmt2 = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $stmt2->execute([$id]);

        Response::created($this->attachRelations($pdo, $stmt2->fetch()), 'Product created.');
    }

    // POST /products/:id (with _method=PUT)
    public function update(array $params): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $product = $stmt->fetch();
        if (!$product) Response::notFound('Product not found.');
        if (!Auth::canAccessBranch($user, (int)$product['branch_id'])) Response::forbidden();

        $body = Request::body();

        // Image upload
        $imageUrl = $product['image'];
        if (!empty($_FILES['image']['name'])) {
            $imageUrl = uploadFile($_FILES['image'], 'products') ?? $imageUrl;
        }

        $pdo->prepare("
            UPDATE products SET
            category_id=?, name=?, name_ar=?, description=?, description_ar=?,
            price=?, image=?, ingredients=?, allergens=?, status=?,
            is_featured=?, is_new=?, calories=?, preparation_time=?, sort_order=?, updated_at=?
            WHERE id=?
        ")->execute([
            $body['category_id']      ?? $product['category_id'],
            sanitize($body['name']    ?? $product['name']),
            sanitize($body['name_ar'] ?? $product['name_ar']),
            sanitize($body['description']    ?? $product['description']),
            sanitize($body['description_ar'] ?? $product['description_ar']),
            isset($body['price']) ? (float)$body['price'] : $product['price'],
            $imageUrl,
            $body['ingredients']       ?? $product['ingredients'],
            $body['allergens']         ?? $product['allergens'],
            $body['status']            ?? $product['status'],
            isset($body['is_featured']) ? (int)$body['is_featured'] : $product['is_featured'],
            isset($body['is_new'])      ? (int)$body['is_new']      : $product['is_new'],
            $body['calories']          ?? $product['calories'],
            $body['preparation_time']  ?? $product['preparation_time'],
            $body['sort_order']        ?? $product['sort_order'],
            now(),
            $params['id'],
        ]);

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $stmt->execute([$params['id']]);
        Response::success($this->attachRelations($pdo, $stmt->fetch()), 'Product updated.');
    }

    // DELETE /products/:id
    public function destroy(array $params): void
    {
        $user = Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT branch_id FROM products WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$params['id']]);
        $product = $stmt->fetch();
        if (!$product) Response::notFound('Product not found.');
        if (!Auth::canAccessBranch($user, (int)$product['branch_id'])) Response::forbidden();

        $pdo->prepare('UPDATE products SET deleted_at = ? WHERE id = ?')
            ->execute([now(), $params['id']]);

        Response::success(null, 'Product deleted.');
    }

    // PATCH /products/:id/toggle
    public function toggle(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);
        $pdo  = Database::get();

        $stmt = $pdo->prepare('SELECT status FROM products WHERE id = ?');
        $stmt->execute([$params['id']]);
        $product = $stmt->fetch();
        if (!$product) Response::notFound();

        $newStatus = $product['status'] === 'active' ? 'inactive' : 'active';
        $pdo->prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?')
            ->execute([$newStatus, now(), $params['id']]);

        Response::success(['status' => $newStatus]);
    }

    // PATCH /products/:id/stock
    public function updateStock(array $params): void
    {
        Auth::requireRole(['super_admin', 'owner', 'manager']);

        $data = Request::validate(['quantity' => 'required|numeric']);
        $pdo  = Database::get();

        $pdo->prepare("
            INSERT INTO stock_items (branch_id, product_id, quantity, min_threshold, unit, created_at, updated_at)
            SELECT branch_id, id, ?, 10, 'piece', ?, ? FROM products WHERE id = ?
            ON DUPLICATE KEY UPDATE quantity = ?, updated_at = ?
        ")->execute([
            (float)$data['quantity'], now(), now(), $params['id'],
            (float)$data['quantity'], now(),
        ]);

        Response::success(null, 'Stock updated.');
    }

    // ─── Private helpers ─────────────────────
    private function attachRelations(PDO $pdo, array $product): array
    {
        $id = $product['id'];

        // Variants
        $stmt = $pdo->prepare('SELECT * FROM product_variants WHERE product_id = ?');
        $stmt->execute([$id]);
        $product['variants'] = $stmt->fetchAll();

        // Addons
        $stmt = $pdo->prepare('SELECT * FROM product_addons WHERE product_id = ?');
        $stmt->execute([$id]);
        $product['addons'] = $stmt->fetchAll();

        // Stock
        $stmt = $pdo->prepare('SELECT * FROM stock_items WHERE product_id = ?');
        $stmt->execute([$id]);
        $stock = $stmt->fetch();
        $product['stock_item'] = $stock ?: null;
        $product['is_low_stock'] = $stock ? ((float)$stock['quantity'] <= (float)$stock['min_threshold']) : false;

        // Decode JSON
        $product['ingredients'] = jsonDecode($product['ingredients']);
        $product['allergens']   = jsonDecode($product['allergens']);
        $product['images']      = jsonDecode($product['images'] ?? null);

        // Cast types
        $product['id']            = (int)$product['id'];
        $product['branch_id']     = (int)$product['branch_id'];
        $product['restaurant_id'] = (int)$product['restaurant_id'];
        $product['price']         = (float)$product['price'];
        $product['ratings_avg']   = (float)$product['ratings_avg'];
        $product['ratings_count'] = (int)$product['ratings_count'];
        $product['is_featured']   = (bool)$product['is_featured'];
        $product['is_new']        = (bool)$product['is_new'];

        return $product;
    }
}
