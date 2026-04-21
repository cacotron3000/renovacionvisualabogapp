<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'cpanel_database',
    'db_user' => 'cpanel_user',
    'db_pass' => 'REEMPLAZAR_PASSWORD',
    'api_key' => 'REEMPLAZAR_API_KEY',
    'timezone' => 'America/Santiago',
    'google_calendar_id' => 'REEMPLAZAR_CALENDAR_ID',
    'google_service_account_json_path' => __DIR__ . '/service-account.json',
    'google_keywords' => ['preparatoria', 'monitorio', 'alegato', 'juicio', 'audiencia', 'comparendo', 'cautelar'],
    'google_sync_days_back' => 90,
];
