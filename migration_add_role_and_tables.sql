-- Migration: añadir campo 'role' a usuarios y crear tablas de productos, carrito y pedidos
-- Ejecutar en la base de datos `meli` (por ejemplo con mysql CLI o phpMyAdmin)

START TRANSACTION;

-- 1) Añadir columna role a usuarios
ALTER TABLE `usuarios`
  ADD COLUMN `role` ENUM('admin','client') NOT NULL DEFAULT 'client';

-- 2) Marcar usuarios existentes como admin cuando correspondan
-- Ajusta la lista a los emails que deban ser administradores
UPDATE `usuarios` SET `role` = 'admin' WHERE `email` IN (
  'admin@gmail.com',
  'admin1@gmail.com',
  'admin34@gmail.com'
);

-- 3) Crear tabla de productos
CREATE TABLE IF NOT EXISTS `productos` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(255) NOT NULL,
  `descripcion` TEXT,
  `precio` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock` INT NOT NULL DEFAULT 0,
  `creado_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4) Crear tabla de carritos (uno por usuario)
CREATE TABLE IF NOT EXISTS `carts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `creado_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5) Items del carrito
CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cart_id` INT NOT NULL,
  `producto_id` INT NOT NULL,
  `cantidad` INT NOT NULL DEFAULT 1,
  `precio_unit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6) Pedidos (orders)
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('pending','paid','shipped','cancelled') NOT NULL DEFAULT 'pending',
  `creado_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7) Items de pedidos
CREATE TABLE IF NOT EXISTS `pedido_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `pedido_id` INT NOT NULL,
  `producto_id` INT NOT NULL,
  `cantidad` INT NOT NULL DEFAULT 1,
  `precio_unit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

-- FIN de migración
