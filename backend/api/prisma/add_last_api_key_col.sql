ALTER TABLE esp_devices 
  ADD COLUMN IF NOT EXISTS last_api_key_id INT NULL,
  ADD INDEX idx_esp_last_api_key (last_api_key_id),
  ADD CONSTRAINT fk_esp_api_key FOREIGN KEY (last_api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;
