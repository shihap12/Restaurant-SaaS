<?php

declare(strict_types=1);

$cfg = require __DIR__ . '/config/app.php';

if ($cfg['debug']) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(0);
}

// ─── CORS ────────────────────────────────────
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = $cfg['allowed_origins'];

if (in_array($origin, $allowed) || $cfg['env'] === 'development') {
    header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Guest-ID, X-Branch-ID, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── Core ────────────────────────────────────
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/RequestResponse.php';
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/helpers/functions.php';

// ─── Controllers ─────────────────────────────
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/ProductController.php';
require_once __DIR__ . '/controllers/OrderController.php';
require_once __DIR__ . '/controllers/OtherControllers.php';   // Category, Branch, Coupon
require_once __DIR__ . '/controllers/MoreControllers.php';    // Restaurant, Admin, User, Guest, AI, Branding, Analytics

// ─── Exception handler ───────────────────────
set_exception_handler(function (Throwable $e) use ($cfg) {
    http_response_code(500);
    $body = ['success' => false, 'message' => 'Server error.'];
    if ($cfg['debug']) {
        $body['debug'] = $e->getMessage();
        $body['file']  = $e->getFile() . ':' . $e->getLine();
    }
    echo json_encode($body);
    exit;
});

// ─── Routes ──────────────────────────────────
$router = new Router();

// ── Health ───────────────────────────────────
$router->get('/health', function () {
    Response::success([
        'app'       => 'Restory API',
        'version'   => '1.0.0',
        'php'       => PHP_VERSION,
        'timestamp' => date('c'),
    ]);
});

// ── Auth ─────────────────────────────────────
$router->post('/auth/login',  [AuthController::class, 'login']);
$router->post('/auth/logout', [AuthController::class, 'logout']);
$router->get('/auth/me',      [AuthController::class, 'me']);

// ── Guest ────────────────────────────────────
$router->post('/guest/init',  [GuestController::class, 'init']);

// ── Admin (Super Admin only) ──────────────────
$router->get('/admin/overview', [AdminController::class, 'overview']);

// ── Restaurants ──────────────────────────────
$router->get('/restaurants',               [RestaurantController::class, 'index']);
$router->get('/restaurants/:id',           [RestaurantController::class, 'show']);
$router->post('/restaurants',              [RestaurantController::class, 'store']);
$router->put('/restaurants/:id',           [RestaurantController::class, 'update']);
$router->delete('/restaurants/:id',        [RestaurantController::class, 'destroy']);
$router->patch('/restaurants/:id/toggle',  [RestaurantController::class, 'toggle']);

// ── Branding (تحت restaurants) ───────────────
$router->get('/restaurants/:id/branding',  [BrandingController::class, 'show']);
$router->put('/restaurants/:id/branding',  [BrandingController::class, 'update']);
$router->post('/restaurants/:id/logo',     [BrandingController::class, 'uploadLogo']);

// ── Branches ─────────────────────────────────
$router->get('/branches',              [BranchController::class, 'index']);
$router->get('/branches/:slug',        [BranchController::class, 'show']);
$router->post('/branches',             [BranchController::class, 'store']);
$router->put('/branches/:id',          [BranchController::class, 'update']);
$router->delete('/branches/:id',       [BranchController::class, 'destroy']);
$router->patch('/branches/:id/toggle', [BranchController::class, 'toggle']);

// ── Categories ───────────────────────────────
$router->get('/categories',            [CategoryController::class, 'index']);
$router->post('/categories',           [CategoryController::class, 'store']);
$router->put('/categories/:id',        [CategoryController::class, 'update']);
$router->delete('/categories/:id',     [CategoryController::class, 'destroy']);
$router->post('/categories/reorder',   [CategoryController::class, 'reorder']);

// ── Products ─────────────────────────────────
$router->get('/products',              [ProductController::class, 'index']);
$router->get('/products/:id',          [ProductController::class, 'show']);
$router->post('/products',             [ProductController::class, 'store']);
$router->post('/products/:id',         [ProductController::class, 'update']); // FormData override
$router->put('/products/:id',          [ProductController::class, 'update']);
$router->delete('/products/:id',       [ProductController::class, 'destroy']);
$router->patch('/products/:id/toggle', [ProductController::class, 'toggle']);
$router->patch('/products/:id/stock',  [ProductController::class, 'updateStock']);

// ── Orders ───────────────────────────────────
$router->get('/orders/guest',              [OrderController::class, 'guestOrders']);
$router->get('/orders/track/:orderNumber', [OrderController::class, 'track']);
$router->get('/orders',                    [OrderController::class, 'index']);
$router->get('/orders/:id',                [OrderController::class, 'show']);
$router->post('/orders',                   [OrderController::class, 'store']);
$router->patch('/orders/:id/status',       [OrderController::class, 'updateStatus']);
$router->patch('/orders/:id/checkout',     [OrderController::class, 'checkout']);

// ── Coupons ──────────────────────────────────
$router->get('/coupons',            [CouponController::class, 'index']);
$router->post('/coupons/validate',  [CouponController::class, 'validate']);
$router->post('/coupons',           [CouponController::class, 'store']);
$router->put('/coupons/:id',        [CouponController::class, 'update']);
$router->delete('/coupons/:id',     [CouponController::class, 'destroy']);

// ── Analytics ────────────────────────────────
$router->get('/analytics/overview',  [AnalyticsController::class, 'overview']);
$router->get('/analytics/revenue',   [AnalyticsController::class, 'revenue']);
$router->get('/analytics/products',  [AnalyticsController::class, 'products']);
$router->get('/analytics/heatmap',   [AnalyticsController::class, 'heatmap']);
$router->get('/analytics/discounts', [AnalyticsController::class, 'discounts']);

// ── Users ────────────────────────────────────
$router->get('/users',              [UserController::class, 'index']);
$router->post('/users',             [UserController::class, 'store']);
$router->put('/users/:id',          [UserController::class, 'update']);
$router->delete('/users/:id',       [UserController::class, 'destroy']);
$router->patch('/users/:id/toggle', [UserController::class, 'toggle']);

// ── Notifications ─────────────────────────────
$router->get('/notifications',                [NotificationController::class, 'index']);
$router->patch('/notifications/read-all',     [NotificationController::class, 'readAll']);
$router->patch('/notifications/:id/read',     [NotificationController::class, 'read']);

// ── Subscriptions ────────────────────────────
$router->get('/subscriptions',                    [SubscriptionController::class, 'index']);
$router->get('/subscriptions/expiring',           [SubscriptionController::class, 'expiring']);
$router->get('/subscriptions/:id',                [SubscriptionController::class, 'show']);
$router->post('/subscriptions',                   [SubscriptionController::class, 'store']);
$router->patch('/subscriptions/:id/cancel',       [SubscriptionController::class, 'cancel']);
$router->patch('/subscriptions/:id/suspend',      [SubscriptionController::class, 'suspend']);
$router->patch('/subscriptions/:id/reactivate',   [SubscriptionController::class, 'reactivate']);
// ─── Dispatch ────────────────────────────────
$router->dispatch();