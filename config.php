<?php

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    ? "https://"
    : "http://";

$baseURL = $protocol .
           $_SERVER['HTTP_HOST'] .
           rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\') .
           '/';

