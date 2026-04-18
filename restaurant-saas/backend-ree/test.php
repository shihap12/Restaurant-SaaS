<?php
$hash = password_hash('password', PASSWORD_BCRYPT);
echo $hash;

// تحقق
$verify = password_verify('password', $hash);
echo $verify ? ' ✓ Works' : ' ✗ Failed';