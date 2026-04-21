<?php

return [
    'name'          => 'Restory',
    'version'       => '1.0.0',
    'env'           => 'development',        // development | production
    'debug'         => true,
    'url'           => 'http://localhost/backend-ree',
    'frontend_url'  => 'http://localhost:3000',

    // JWT / token secret — change in production!
    'jwt_secret'    => 'restory_super_secret_key_change_this_2024',
    'jwt_expire'    => 86400 * 7,            // 7 days in seconds

    // Encryption key for sensitive fields (phone, address)
    'encrypt_key'   => 'restory_encrypt_key_32chars_change!',

    // File uploads
    'upload_path'   => __DIR__ . '/../uploads/',
    // Public URL where uploaded files are served from. Adjusted to match project folder name.
    'upload_url'    => 'http://localhost/backend-ree/uploads/',
    'max_file_size' => 2 * 1024 * 1024,     // 2 MB

    // OpenAI (for AI Waiter) — optional
    'openai_key'    => '',                   // paste your key here
    'openai_model'  => 'gpt-4o-mini',

    // Rate limits
    'guest_orders_per_hour' => 5,
    'ai_requests_per_min'   => 40,

    // CORS allowed origins
    'allowed_origins' => [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://localhost',
    ],
];
