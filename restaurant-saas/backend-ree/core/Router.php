<?php

class Router
{
    private array $routes = [];

    public function get(string $path, callable|array $handler, array $mw = []): void
    {
        $this->add('GET', $path, $handler, $mw);
    }

    public function post(string $path, callable|array $handler, array $mw = []): void
    {
        $this->add('POST', $path, $handler, $mw);
    }

    public function put(string $path, callable|array $handler, array $mw = []): void
    {
        $this->add('PUT', $path, $handler, $mw);
    }

    public function patch(string $path, callable|array $handler, array $mw = []): void
    {
        $this->add('PATCH', $path, $handler, $mw);
    }

    public function delete(string $path, callable|array $handler, array $mw = []): void
    {
        $this->add('DELETE', $path, $handler, $mw);
    }

    private function add(string $method, string $path, callable|array $handler, array $mw): void
    {
        $this->routes[] = [
            'method'  => $method,
            'path'    => $path,
            'handler' => $handler,
            'mw'      => $mw,
        ];
    }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper($_POST['_method']);
        }

        if ($method === 'OPTIONS') {
            http_response_code(200);
            exit;
        }

        $uri = $this->getUri();

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;

            $params = $this->match($route['path'], $uri);
            if ($params === false) continue;

            foreach ($route['mw'] as $mwClass) {
                (new $mwClass())->handle();
            }

            // ─── Call handler ─────────────────
            $handler = $route['handler'];

            if (is_callable($handler)) {
                $handler($params);
            } elseif (is_array($handler)) {
                [$class, $action] = $handler;
                (new $class())->$action($params);
            }

            return; // ← واحدة بس
        }

        Response::json(['success' => false, 'message' => 'Route not found.'], 404);
    }

    private function getUri(): string
    {
        $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
        $uri       = $_SERVER['REQUEST_URI'];

        if ($scriptDir !== '/' && str_starts_with($uri, $scriptDir)) {
            $uri = substr($uri, strlen($scriptDir));
        }

        $uri = strtok($uri, '?');
        return '/' . trim($uri, '/');
    }

    private function match(string $pattern, string $uri): array|false
    {
        $regex = preg_replace('/\/:([^\/]+)/', '/(?P<$1>[^/]+)', $pattern);
        $regex = '@^' . $regex . '$@';

        if (!preg_match($regex, $uri, $matches)) {
            return false;
        }

        return array_filter($matches, fn($k) => is_string($k), ARRAY_FILTER_USE_KEY);
    }
}