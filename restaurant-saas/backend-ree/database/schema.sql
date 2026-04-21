-- ============================================================
-- RESTORY — MySQL Schema + Seed Data (Updated)
-- Import via phpMyAdmin or: mysql -u root restory_db < schema.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `restory_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `restory_db`;

-- ─── users ───────────────────────────────────
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL UNIQUE,
  `password`      VARCHAR(255) NOT NULL,
  `role`          ENUM('super_admin','owner','manager','cashier','chef','customer') NOT NULL DEFAULT 'customer',
  `restaurant_id` INT UNSIGNED DEFAULT NULL,
  `branch_id`     INT UNSIGNED DEFAULT NULL,
  `phone`         VARCHAR(20)  DEFAULT NULL,
  `avatar`        VARCHAR(500) DEFAULT NULL,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login_at` DATETIME     DEFAULT NULL,
  `deleted_at`    DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email`      (`email`),
  INDEX `idx_role`       (`role`),
  INDEX `idx_branch`     (`branch_id`),
  INDEX `idx_restaurant` (`restaurant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── restaurants ─────────────────────────────
DROP TABLE IF EXISTS `restaurants`;
CREATE TABLE `restaurants` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id`      INT UNSIGNED NOT NULL,
  `name`          VARCHAR(150) NOT NULL,
  `slug`          VARCHAR(160) NOT NULL UNIQUE,
  `logo`          VARCHAR(500) DEFAULT NULL,
  `cover_image`   VARCHAR(500) DEFAULT NULL,
  `description`   TEXT         DEFAULT NULL,
  `cuisine_type`  VARCHAR(80)  DEFAULT NULL,
  `branding`      JSON         DEFAULT NULL,
  `plan`          ENUM('trial','basic','pro','enterprise') NOT NULL DEFAULT 'trial',
  `max_branches`  INT          NOT NULL DEFAULT 3,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `notes`         TEXT         DEFAULT NULL,
  `deleted_at`    DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_owner`  (`owner_id`),
  INDEX `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── branches ────────────────────────────────
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id`                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `restaurant_id`        INT UNSIGNED NOT NULL,
  `manager_id`           INT UNSIGNED DEFAULT NULL,  -- مدير الفرع (اختياري)
  `name`                 VARCHAR(150) NOT NULL,
  `slug`                 VARCHAR(160) NOT NULL UNIQUE, -- رابط الفرع (يحدده الأدمن)
  `custom_domain`        VARCHAR(255) DEFAULT NULL,    -- دومين خاص مستقبلاً
  `address`              TEXT         NOT NULL,
  `phone`                VARCHAR(20)  DEFAULT NULL,
  `email`                VARCHAR(150) DEFAULT NULL,
  `lat`                  DECIMAL(10,7) DEFAULT NULL,
  `lng`                  DECIMAL(10,7) DEFAULT NULL,
  `timezone`             VARCHAR(50)  NOT NULL DEFAULT 'UTC',
  `currency`             CHAR(3)      NOT NULL DEFAULT 'USD',
  `currency_symbol`      VARCHAR(5)   NOT NULL DEFAULT '$',
  `is_active`            TINYINT(1)   NOT NULL DEFAULT 1,
  `is_accepting_orders`  TINYINT(1)   NOT NULL DEFAULT 1,
  `opening_hours`        JSON         DEFAULT NULL,
  `settings`             JSON         DEFAULT NULL,
  `deleted_at`           DATETIME     DEFAULT NULL,
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_restaurant` (`restaurant_id`),
  INDEX `idx_active`     (`is_active`),
  INDEX `idx_slug`       (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── categories ──────────────────────────────
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id`     INT UNSIGNED NOT NULL,
  `restaurant_id` INT UNSIGNED NOT NULL,
  `name`          VARCHAR(100) NOT NULL,
  `name_ar`       VARCHAR(100) DEFAULT NULL,
  `description`   TEXT         DEFAULT NULL,
  `image`         VARCHAR(500) DEFAULT NULL,
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch` (`branch_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── products ────────────────────────────────
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`        INT UNSIGNED  NOT NULL,
  `restaurant_id`    INT UNSIGNED  NOT NULL,
  `category_id`      INT UNSIGNED  DEFAULT NULL,
  `name`             VARCHAR(255)  NOT NULL,
  `name_ar`          VARCHAR(255)  DEFAULT NULL,
  `description`      TEXT          DEFAULT NULL,
  `description_ar`   TEXT          DEFAULT NULL,
  `price`            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `image`            VARCHAR(500)  DEFAULT NULL,
  `images`           JSON          DEFAULT NULL,
  `ingredients`      JSON          DEFAULT NULL,
  `allergens`        JSON          DEFAULT NULL,
  `status`           ENUM('active','inactive','out_of_stock') NOT NULL DEFAULT 'active',
  `is_featured`      TINYINT(1)    NOT NULL DEFAULT 0,
  `is_new`           TINYINT(1)    NOT NULL DEFAULT 0,
  `calories`         INT           DEFAULT NULL,
  `preparation_time` INT           DEFAULT NULL,
  `sort_order`       INT           NOT NULL DEFAULT 0,
  `ratings_avg`      DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  `ratings_count`    INT           NOT NULL DEFAULT 0,
  `deleted_at`       DATETIME      DEFAULT NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_status`   (`branch_id`, `status`),
  INDEX `idx_branch_category` (`branch_id`, `category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── product_variants ────────────────────────
DROP TABLE IF EXISTS `product_variants`;
CREATE TABLE `product_variants` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`      INT UNSIGNED  NOT NULL,
  `product_id`     INT UNSIGNED  NOT NULL,
  `name`           VARCHAR(100)  NOT NULL,
  `price_modifier` DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `is_default`     TINYINT(1)    NOT NULL DEFAULT 0,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── product_addons ──────────────────────────
DROP TABLE IF EXISTS `product_addons`;
CREATE TABLE `product_addons` (
  `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`    INT UNSIGNED  NOT NULL,
  `product_id`   INT UNSIGNED  NOT NULL,
  `name`         VARCHAR(100)  NOT NULL,
  `price`        DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `max_quantity` INT           NOT NULL DEFAULT 1,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── stock_items ─────────────────────────────
DROP TABLE IF EXISTS `stock_items`;
CREATE TABLE `stock_items` (
  `id`            INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `branch_id`     INT UNSIGNED   NOT NULL,
  `product_id`    INT UNSIGNED   NOT NULL,
  `quantity`      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  `min_threshold` DECIMAL(10,2)  NOT NULL DEFAULT 10.00,
  `unit`          VARCHAR(20)    NOT NULL DEFAULT 'piece',
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branch_product` (`branch_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── coupons ─────────────────────────────────
DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
  `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`         INT UNSIGNED  NOT NULL,
  `code`              VARCHAR(30)   NOT NULL UNIQUE,
  `type`              ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  `value`             DECIMAL(8,2)  NOT NULL,
  `min_order_amount`  DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `max_discount`      DECIMAL(8,2)  DEFAULT NULL,
  `usage_limit`       INT           DEFAULT NULL,
  `used_count`        INT           NOT NULL DEFAULT 0,
  `is_active`         TINYINT(1)    NOT NULL DEFAULT 1,
  `description`       VARCHAR(255)  DEFAULT NULL,
  `qr_code_url`       VARCHAR(500)  DEFAULT NULL,
  `starts_at`         DATETIME      DEFAULT NULL,
  `expires_at`        DATETIME      DEFAULT NULL,
  `deleted_at`        DATETIME      DEFAULT NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_active` (`branch_id`, `is_active`),
  INDEX `idx_code`          (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── orders ──────────────────────────────────
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`            INT UNSIGNED  NOT NULL,
  `user_id`              INT UNSIGNED  DEFAULT NULL,
  `guest_id`             VARCHAR(50)   DEFAULT NULL,
  `order_number`         VARCHAR(30)   NOT NULL UNIQUE,
  `type`                 ENUM('dine_in','delivery','pickup') NOT NULL DEFAULT 'dine_in',
  `status`               ENUM('pending','accepted','preparing','ready','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `payment_method`       ENUM('cash','card') NOT NULL DEFAULT 'cash',
  `payment_status`       ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `customer_name`        VARCHAR(100)  NOT NULL,
  `customer_phone`       TEXT          DEFAULT NULL,
  `customer_address`     TEXT          DEFAULT NULL,
  `table_number`         VARCHAR(20)   DEFAULT NULL,
  `special_instructions` TEXT          DEFAULT NULL,
  `subtotal`             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount`             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `delivery_fee`         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tax`                  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total`                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `coupon_id`            INT UNSIGNED  DEFAULT NULL,
  `estimated_ready_at`   DATETIME      DEFAULT NULL,
  `accepted_at`          DATETIME      DEFAULT NULL,
  `ready_at`             DATETIME      DEFAULT NULL,
  `delivered_at`         DATETIME      DEFAULT NULL,
  `deleted_at`           DATETIME      DEFAULT NULL,
  `created_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_status`  (`branch_id`, `status`),
  INDEX `idx_branch_date`    (`branch_id`, `created_at`),
  INDEX `idx_guest`          (`guest_id`),
  INDEX `idx_order_number`   (`order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── order_items ─────────────────────────────
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `branch_id`            INT UNSIGNED  NOT NULL,
  `order_id`             INT UNSIGNED  NOT NULL,
  `product_id`           INT UNSIGNED  DEFAULT NULL,
  `product_name`         VARCHAR(255)  NOT NULL,
  `product_image`        VARCHAR(500)  DEFAULT NULL,
  `quantity`             INT           NOT NULL DEFAULT 1,
  `unit_price`           DECIMAL(10,2) NOT NULL,
  `total_price`          DECIMAL(10,2) NOT NULL,
  `variant_name`         VARCHAR(100)  DEFAULT NULL,
  `addons`               JSON          DEFAULT NULL,
  `special_instructions` TEXT          DEFAULT NULL,
  `created_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_order`       (`order_id`),
  INDEX `idx_branch_order`(`branch_id`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── guest_sessions ──────────────────────────
DROP TABLE IF EXISTS `guest_sessions`;
CREATE TABLE `guest_sessions` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id`      INT UNSIGNED NOT NULL,
  `guest_id`       VARCHAR(60)  NOT NULL UNIQUE,
  `ip_address`     VARCHAR(45)  DEFAULT NULL,
  `order_count`    INT          NOT NULL DEFAULT 0,
  `last_active_at` DATETIME     DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_guest_id` (`guest_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── notifications ───────────────────────────
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `branch_id`  INT UNSIGNED DEFAULT NULL,
  `type`       VARCHAR(50)  NOT NULL,
  `title`      VARCHAR(255) NOT NULL,
  `body`       TEXT         DEFAULT NULL,
  `data`       JSON         DEFAULT NULL,
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `read_at`    DATETIME     DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_read` (`user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- VIEW: platform_overview (للـ Super Admin Dashboard)
-- ============================================================
CREATE OR REPLACE VIEW `platform_overview` AS
SELECT
  (SELECT COUNT(*) FROM restaurants WHERE deleted_at IS NULL)                                       AS total_restaurants,
  (SELECT COUNT(*) FROM restaurants WHERE is_active = 1 AND deleted_at IS NULL)                     AS active_restaurants,
  (SELECT COUNT(*) FROM branches WHERE deleted_at IS NULL)                                           AS total_branches,
  (SELECT COUNT(*) FROM branches WHERE is_active = 1 AND deleted_at IS NULL)                         AS active_branches,
  (SELECT COUNT(*) FROM users WHERE role NOT IN ('super_admin','customer') AND deleted_at IS NULL)   AS total_staff,
  (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE())                                   AS orders_today,
  (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = CURDATE())                   AS revenue_today,
  (SELECT COUNT(*) FROM orders WHERE status = 'pending')                                             AS pending_orders;

-- ============================================================
-- VIEW: branch_stats (ملخص كل فرع)
-- ============================================================
CREATE OR REPLACE VIEW `branch_stats` AS
SELECT
  b.id                                                                              AS branch_id,
  b.name                                                                            AS branch_name,
  b.slug                                                                            AS branch_slug,
  b.restaurant_id,
  r.name                                                                            AS restaurant_name,
  r.plan                                                                            AS restaurant_plan,
  COUNT(DISTINCT u.id)                                                              AS staff_count,
  COUNT(DISTINCT p.id)                                                              AS product_count,
  COUNT(DISTINCT o.id)                                                              AS orders_today,
  COALESCE(SUM(CASE WHEN DATE(o.created_at) = CURDATE() THEN o.total ELSE 0 END), 0) AS revenue_today
FROM branches b
LEFT JOIN restaurants r ON r.id = b.restaurant_id
LEFT JOIN users u ON u.branch_id = b.id AND u.role NOT IN ('super_admin','customer','owner')
LEFT JOIN products p ON p.branch_id = b.id AND p.deleted_at IS NULL AND p.status = 'active'
LEFT JOIN orders o ON o.branch_id = b.id AND DATE(o.created_at) = CURDATE()
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.slug, b.restaurant_id, r.name, r.plan;

-- ============================================================
-- SEED DATA
-- ============================================================

-- ─── Users ───────────────────────────────────
-- كلمة السر لكلهم: password
-- غيّر الـ hash بالـ hash اللي طلع من test.php عندك
SET @pw = '$2y$10$Y7JJJAEWCMkixGgaoi/svemwOsn0aS5sbAcugLUydAgrAI.djlEmu';

INSERT INTO `users` (`name`, `email`, `password`, `role`, `is_active`) VALUES
('Super Admin',   'admin@restory.app',   @pw, 'super_admin', 1),
('Ahmad Al-Rashid','owner@restory.app',  @pw, 'owner',       1),
('Khalid Manager','manager@restory.app', @pw, 'manager',     1),
('Sara Cashier',  'cashier@restory.app', @pw, 'cashier',     1),
('Mohammed Chef', 'chef@restory.app',    @pw, 'chef',        1),
('Nora Cashier',  'nora@restory.app',    @pw, 'cashier',     1),
('Yasser Chef',   'yasser@restory.app',  @pw, 'chef',        1),
('Lina Manager',  'lina@restory.app',    @pw, 'manager',     1);

-- ─── Restaurants ─────────────────────────────
INSERT INTO `restaurants` (`owner_id`, `name`, `slug`, `description`, `cuisine_type`, `plan`, `max_branches`, `branding`, `is_active`) VALUES
(2, 'Bab Al Hara', 'bab-al-hara', 'Authentic Arabian cuisine with a modern twist.', 'Arabian', 'pro', 5,
 '{"theme":"dark","primary_color":"#f97316","font_display":"Playfair Display","font_body":"DM Sans","tagline":"Where tradition meets flavor","about_text":"Founded in 2015, serving authentic Arabian cuisine with love."}',
 1);

-- ─── ربط الـ Owner بالمطعم ───────────────────
UPDATE `users` SET `restaurant_id` = 1 WHERE `role` = 'owner';

-- ─── Branches ────────────────────────────────
INSERT INTO `branches` (`restaurant_id`, `manager_id`, `name`, `slug`, `address`, `phone`, `currency`, `currency_symbol`, `timezone`, `is_active`, `is_accepting_orders`, `opening_hours`, `settings`) VALUES
(1, 3, 'Main Branch - Riyadh', 'bab-al-hara-riyadh',
 'King Fahd Road, Olaya, Riyadh', '+966112345678', 'SAR', '﷼', 'Asia/Riyadh', 1, 1,
 '[{"day":0,"open":"10:00","close":"23:00","is_closed":false},{"day":1,"open":"10:00","close":"23:00","is_closed":false},{"day":2,"open":"10:00","close":"23:00","is_closed":false},{"day":3,"open":"10:00","close":"23:00","is_closed":false},{"day":4,"open":"10:00","close":"23:00","is_closed":false},{"day":5,"open":"10:00","close":"00:00","is_closed":false},{"day":6,"open":"10:00","close":"00:00","is_closed":false}]',
 '{"min_order_amount":30,"delivery_radius_km":10,"delivery_fee":15,"free_delivery_above":150,"estimated_prep_time":20,"estimated_delivery_time":45}'),

(1, 8, 'Jeddah Branch', 'bab-al-hara-jeddah',
 'Corniche Road, Al-Balad, Jeddah', '+966122345678', 'SAR', '﷼', 'Asia/Riyadh', 1, 1,
 '[{"day":0,"open":"10:00","close":"23:00","is_closed":false},{"day":1,"open":"10:00","close":"23:00","is_closed":false},{"day":2,"open":"10:00","close":"23:00","is_closed":false},{"day":3,"open":"10:00","close":"23:00","is_closed":false},{"day":4,"open":"10:00","close":"23:00","is_closed":false},{"day":5,"open":"10:00","close":"00:00","is_closed":false},{"day":6,"open":"10:00","close":"00:00","is_closed":false}]',
 '{"min_order_amount":30,"delivery_radius_km":8,"delivery_fee":15,"free_delivery_above":150,"estimated_prep_time":20,"estimated_delivery_time":45}');

-- ─── ربط الـ Staff بالفروع ───────────────────
-- فرع الرياض
UPDATE `users` SET `restaurant_id` = 1, `branch_id` = 1 WHERE `id` IN (3, 4, 5);
-- فرع جدة
UPDATE `users` SET `restaurant_id` = 1, `branch_id` = 2 WHERE `id` IN (6, 7, 8);

-- ─── Categories ──────────────────────────────
INSERT INTO `categories` (`branch_id`, `restaurant_id`, `name`, `name_ar`, `sort_order`, `is_active`) VALUES
(1, 1, 'Starters',    'المقبلات',          1, 1),
(1, 1, 'Grills',      'المشويات',          2, 1),
(1, 1, 'Main Dishes', 'الأطباق الرئيسية', 3, 1),
(1, 1, 'Salads',      'السلطات',           4, 1),
(1, 1, 'Soups',       'الشوربات',          5, 1),
(1, 1, 'Desserts',    'الحلويات',          6, 1),
(1, 1, 'Drinks',      'المشروبات',         7, 1);

-- ─── Products ────────────────────────────────
INSERT INTO `products` (`branch_id`, `restaurant_id`, `category_id`, `name`, `name_ar`, `description`, `price`, `ingredients`, `allergens`, `status`, `is_featured`, `is_new`, `calories`, `preparation_time`, `sort_order`, `ratings_avg`, `ratings_count`) VALUES
(1,1,1,'Hummus','حمص','Creamy chickpea dip with olive oil, tahini, and warm pita bread',28.00,'[{"name":"Chickpeas","is_allergen":false},{"name":"Tahini","is_allergen":true},{"name":"Garlic","is_allergen":false}]','["sesame"]','active',1,0,180,5,1,4.80,124),
(1,1,1,'Mixed Mezze Platter','طبق مزة مشكل','Assorted mezze: hummus, baba ghanoush, tabbouleh and more',65.00,'[{"name":"Chickpeas","is_allergen":false},{"name":"Eggplant","is_allergen":false}]','["sesame"]','active',1,0,450,10,2,4.90,203),
(1,1,1,'Fattoush Salad','سلطة فتوش','Fresh vegetables with crispy pita croutons and sumac dressing',32.00,'[{"name":"Lettuce","is_allergen":false},{"name":"Tomatoes","is_allergen":false},{"name":"Pita","is_allergen":true}]','["gluten"]','active',0,1,220,8,3,4.60,87),
(1,1,2,'Mixed Grill Platter','مشويات مشكلة','Lamb chops, chicken skewers, kofta — served with rice and salad',185.00,'[{"name":"Lamb","is_allergen":false},{"name":"Chicken","is_allergen":false}]','[]','active',1,0,820,25,4,4.90,312),
(1,1,2,'Lamb Chops','ضلوع خروف','Tender marinated lamb chops grilled to perfection',145.00,'[{"name":"Lamb","is_allergen":false},{"name":"Herbs","is_allergen":false}]','[]','active',0,0,580,20,5,4.70,156),
(1,1,2,'Shish Tawook','شيش طاووق','Marinated chicken cubes grilled on skewers with garlic sauce',78.00,'[{"name":"Chicken","is_allergen":false},{"name":"Garlic","is_allergen":false},{"name":"Dairy","is_allergen":true}]','["dairy"]','active',0,0,420,15,6,4.50,198),
(1,1,3,'Kabsa Al-Laham','كبسة اللحم','Traditional Saudi rice dish with tender lamb, spices, and nuts',120.00,'[{"name":"Rice","is_allergen":false},{"name":"Lamb","is_allergen":false},{"name":"Nuts","is_allergen":true}]','["tree_nuts"]','active',1,0,680,45,7,4.90,445),
(1,1,3,'Mandi Chicken','مندي دجاج','Slow-cooked whole chicken over fragrant saffron rice',95.00,'[{"name":"Chicken","is_allergen":false},{"name":"Saffron","is_allergen":false},{"name":"Rice","is_allergen":false}]','[]','active',0,0,720,60,8,4.80,287),
(1,1,6,'Umm Ali','أم علي','Traditional bread pudding with cream, nuts, and coconut',38.00,'[{"name":"Milk","is_allergen":true},{"name":"Nuts","is_allergen":true},{"name":"Puff pastry","is_allergen":true}]','["dairy","tree_nuts","gluten"]','active',0,1,380,10,9,4.70,132),
(1,1,6,'Baklava Mix','بقلاوة مشكلة','Assorted baklava with pistachios, cashews, and syrup',45.00,'[{"name":"Phyllo dough","is_allergen":true},{"name":"Pistachios","is_allergen":true}]','["gluten","tree_nuts"]','active',0,0,420,5,10,4.60,95),
(1,1,7,'Mint Lemonade','ليمون بالنعناع','Fresh-squeezed lemonade with crushed mint and ice',22.00,'[{"name":"Lemon","is_allergen":false},{"name":"Mint","is_allergen":false}]','[]','active',0,0,95,3,11,4.50,201),
(1,1,7,'Saudi Qahwa','قهوة سعودية','Traditional Saudi cardamom coffee served with dates',18.00,'[{"name":"Coffee","is_allergen":false},{"name":"Cardamom","is_allergen":false}]','[]','active',0,0,25,3,12,4.80,178);

-- ─── Product Variants ────────────────────────
INSERT INTO `product_variants` (`branch_id`, `product_id`, `name`, `price_modifier`, `is_default`) VALUES
(1, 4, 'For 2 persons',  0.00,   1),
(1, 4, 'For 4 persons',  120.00, 0),
(1, 4, 'For 6 persons',  260.00, 0);

-- ─── Product Addons ──────────────────────────
INSERT INTO `product_addons` (`branch_id`, `product_id`, `name`, `price`, `max_quantity`) VALUES
(1, 7, 'Extra Meat',  45.00, 2),
(1, 7, 'Extra Rice',  15.00, 2),
(1, 7, 'Salad Side',  20.00, 1);

-- ─── Stock Items ─────────────────────────────
INSERT INTO `stock_items` (`branch_id`, `product_id`, `quantity`, `min_threshold`, `unit`)
SELECT 1, id, FLOOR(50 + RAND() * 150), 10, 'piece'
FROM `products`
WHERE branch_id = 1;

-- ─── Coupons ─────────────────────────────────
INSERT INTO `coupons` (`branch_id`, `code`, `type`, `value`, `min_order_amount`, `max_discount`, `usage_limit`, `used_count`, `is_active`, `description`, `starts_at`, `expires_at`) VALUES
(1, 'WELCOME20', 'percentage', 20.00, 50.00,  80.00,  100,  34,  1, 'New customer welcome discount',       NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
(1, 'RAMADAN30', 'percentage', 30.00, 100.00, 150.00, 500,  127, 1, 'Ramadan special offer',               NOW(), DATE_ADD(NOW(), INTERVAL 25 DAY)),
(1, 'FLAT50',    'fixed',      50.00, 200.00, NULL,   NULL, 22,  1, '50 SAR off on orders above 200',      NOW(), NULL),
(2, 'JED15',     'percentage', 15.00, 60.00,  60.00,  200,  48,  1, 'Jeddah branch special',               NOW(), DATE_ADD(NOW(), INTERVAL 20 DAY));

-- ─── Sample Orders ───────────────────────────
INSERT INTO `orders` (`branch_id`, `user_id`, `guest_id`, `order_number`, `type`, `status`, `payment_method`, `payment_status`, `customer_name`, `subtotal`, `discount`, `delivery_fee`, `total`, `estimated_ready_at`, `created_at`, `updated_at`) VALUES
(1, NULL, 'guest_demo_001', 'ORD20240001', 'dine_in',  'pending',   'cash', 'pending', 'Ali Hassan',        213.00, 0,     0,  213.00, DATE_ADD(NOW(), INTERVAL 25 MINUTE), NOW(), NOW()),
(1, NULL, 'guest_demo_002', 'ORD20240002', 'delivery', 'preparing', 'card', 'paid',    'Fatima Al-Zahrani', 120.00, 24.00, 15, 111.00, DATE_ADD(NOW(), INTERVAL 20 MINUTE), DATE_SUB(NOW(), INTERVAL 10 MINUTE), NOW()),
(1, NULL, 'guest_demo_003', 'ORD20240003', 'pickup',   'ready',     'cash', 'pending', 'Omar Khalid',       185.00, 0,     0,  185.00, NOW(),                               DATE_SUB(NOW(), INTERVAL 25 MINUTE), NOW()),
(1, NULL, 'guest_demo_004', 'ORD20240004', 'dine_in',  'delivered', 'cash', 'paid',    'Nour Al-Rashidi',   95.00,  0,     0,  95.00,  DATE_SUB(NOW(), INTERVAL 20 MINUTE), DATE_SUB(NOW(), INTERVAL 60 MINUTE), NOW());

INSERT INTO `order_items` (`branch_id`, `order_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `total_price`) VALUES
(1, 1, 4, 'Mixed Grill Platter', 1, 185.00, 185.00),
(1, 1, 1, 'Hummus',              1, 28.00,  28.00),
(1, 2, 7, 'Kabsa Al-Laham',      1, 120.00, 120.00),
(1, 3, 4, 'Mixed Grill Platter', 1, 185.00, 185.00),
(1, 4, 8, 'Mandi Chicken',       1, 95.00,  95.00);

-- ─── Sample Notifications ────────────────────
INSERT INTO `notifications` (`user_id`, `branch_id`, `type`, `title`, `body`, `is_read`) VALUES
(3, 1, 'new_order',    'New Order Received',     'Order #ORD20240001 has been placed.', 0),
(3, 1, 'new_order',    'New Order Received',     'Order #ORD20240002 has been placed.', 1),
(4, 1, 'order_ready',  'Order Ready for Pickup', 'Order #ORD20240003 is ready.',        0);

SELECT 'Restory DB ready! Login: admin@restory.app / password' AS message;

CREATE TABLE `subscriptions` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `restaurant_id` INT UNSIGNED NOT NULL,
  `plan`          ENUM('trial','basic','pro','enterprise') NOT NULL DEFAULT 'trial',
  `status`        ENUM('active','expired','cancelled','suspended') NOT NULL DEFAULT 'active',
  `amount`        DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `currency`      CHAR(3) NOT NULL DEFAULT 'SAR',
  `starts_at`     DATETIME NOT NULL,
  `expires_at`    DATETIME NOT NULL,
  `notes`         TEXT DEFAULT NULL,
  `created_by`    INT UNSIGNED DEFAULT NULL,  -- السوبر ادمن اللي أنشأه
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_restaurant` (`restaurant_id`),
  INDEX `idx_status`     (`status`),
  INDEX `idx_expires`    (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: اشتراك للمطعم الموجود
INSERT INTO `subscriptions` 
  (`restaurant_id`, `plan`, `status`, `amount`, `starts_at`, `expires_at`, `created_by`)
VALUES 
  (1, 'pro', 'active', 1200.00, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 1);

  ALTER TABLE orders ADD COLUMN `served_at` DATETIME DEFAULT NULL AFTER `ready_at`;