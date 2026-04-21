<?php

// ─── Request ─────────────────────────────────
class Request
{
    private static ?array $body = null;

    /** Get decoded JSON body or POST data */
    public static function body(): array
    {
        if (self::$body !== null) return self::$body;

        $raw = file_get_contents('php://input');

        // Remove UTF-8 BOM if present to allow json_decode to work
        if (is_string($raw) && strlen($raw) >= 3 && substr($raw, 0, 3) === "\xEF\xBB\xBF") {
            $raw = substr($raw, 3);
        }

        $json = json_decode($raw, true);

        if (is_array($json)) {
            self::$body = $json;
        } elseif (!empty($_POST)) {
            self::$body = $_POST;
        } else {
            // Attempt to parse urlencoded/raw form data as a fallback
            $parsed = [];
            parse_str($raw, $parsed);
            if (!empty($parsed)) {
                self::$body = $parsed;
            } else {
                self::$body = [];
            }
        }

        return self::$body;
    }

    /** Get a single body field with optional default */
    public static function input(string $key, mixed $default = null): mixed
    {
        return self::body()[$key] ?? $_GET[$key] ?? $default;
    }

    /** Get query param */
    public static function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    /** Get all query params */
    public static function allQuery(): array
    {
        return $_GET;
    }

    /** Validate body fields — throws 422 on failure */
    public static function validate(array $rules): array
    {
        $body   = self::body();
        $errors = [];
        $data   = [];

        foreach ($rules as $field => $rule) {
            $parts    = explode('|', $rule);
            $required = in_array('required', $parts);
            $value    = $body[$field] ?? $_FILES[$field] ?? null;

            if (is_string($value)) {
                $value = trim($value);
            }

            if ($required && ($value === null || $value === '')) {
                $errors[$field][] = "The {$field} field is required.";
                continue;
            }

            if ($value === null || $value === '') {
                $data[$field] = null;
                continue;
            }

            foreach ($parts as $r) {
                if ($r === 'required') continue;

                if ($r === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[$field][] = "The {$field} must be a valid email.";
                }
                if (str_starts_with($r, 'min:') && strlen((string)$value) < (int)substr($r, 4)) {
                    $errors[$field][] = "The {$field} must be at least " . substr($r, 4) . " characters.";
                }
                if (str_starts_with($r, 'max:') && strlen((string)$value) > (int)substr($r, 4)) {
                    $errors[$field][] = "The {$field} must not exceed " . substr($r, 4) . " characters.";
                }
                if ($r === 'integer' && !is_numeric($value)) {
                    $errors[$field][] = "The {$field} must be an integer.";
                }
                if ($r === 'numeric' && !is_numeric($value)) {
                    $errors[$field][] = "The {$field} must be numeric.";
                }
                if (str_starts_with($r, 'in:')) {
                    $allowed = explode(',', substr($r, 3));
                    if (!in_array($value, $allowed)) {
                        $errors[$field][] = "The {$field} must be one of: " . implode(', ', $allowed) . ".";
                    }
                }
            }

            $data[$field] = $value;
        }

        if (!empty($errors)) {
            Response::json(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors], 422);
            exit;
        }

        return $data;
    }

    /** Get bearer token from Authorization header */
    public static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? getallheaders()['Authorization']
            ?? '';

        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }

    public static function method(): string
    {
        return $_SERVER['REQUEST_METHOD'];
    }

    public static function ip(): string
    {
        return $_SERVER['HTTP_X_FORWARDED_FOR']
            ?? $_SERVER['REMOTE_ADDR']
            ?? '0.0.0.0';
    }
}

// ─── Response ────────────────────────────────
class Response
{
    public static function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(mixed $data = null, string $message = 'OK', int $status = 200): void
    {
        self::json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    public static function created(mixed $data = null, string $message = 'Created.'): void
    {
        self::success($data, $message, 201);
    }

    public static function error(string $message, int $status = 400, array $errors = []): void
    {
        $body = ['success' => false, 'message' => $message];
        if (!empty($errors)) $body['errors'] = $errors;
        self::json($body, $status);
    }

    public static function notFound(string $message = 'Not found.'): void
    {
        self::error($message, 404);
    }

    public static function unauthorized(string $message = 'Unauthorized.'): void
    {
        self::error($message, 401);
    }

    public static function forbidden(string $message = 'Access denied.'): void
    {
        self::error($message, 403);
    }

    public static function paginated(array $items, int $total, int $page, int $perPage): void
    {
        self::json([
            'success' => true,
            'data'    => $items,
            'meta'    => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => (int) ceil($total / max($perPage, 1)),
            ],
        ]);
    }
}
