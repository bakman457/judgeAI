ALTER TABLE `ai_provider_settings`
  MODIFY COLUMN `providerType`
  ENUM('openai','azure_openai','custom_openai_compatible','alibaba_cloud','kimi','deepseek') NOT NULL;
