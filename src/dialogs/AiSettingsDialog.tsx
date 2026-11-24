import { Dialog, submitWith } from "../ui/Modal";
import { useState } from "react";
import { aiProviders, type AiProvider, type AiSettings } from "../ai/ai";
import { t } from "../i18n";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";
import { Input, Select } from "../ui/Field";
import { dialogFooterClass, dialogTitleClass } from "./dialogLook";

const labelClass = "flex flex-col gap-1 font-semibold";

/** Provider, key and model; the key never leaves this device except in requests to the chosen provider. */
export function AiSettingsDialog({
  settings,
  onSave,
  onClose,
}: {
  settings: AiSettings | null;
  onSave: (settings: AiSettings | null) => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<AiProvider>(settings?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? "");
  const [model, setModel] = useState(settings?.model ?? aiProviders.anthropic.model);
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? "");
  return (
    <Dialog
      label={t("dialogs.aiSettingsLabel")}
      onDismiss={onClose}
      onSubmit={submitWith(() =>
        onSave({
          provider,
          apiKey: apiKey.trim(),
          model: model.trim(),
          baseUrl: provider === "compatible" ? baseUrl.trim() : undefined,
        }),
      )}
    >
      <h2 className={dialogTitleClass}>{t("dialogs.aiTitle")}</h2>
      <label className={labelClass}>
        {t("dialogs.aiProvider")}
        <Select
          value={provider}
          onChange={(event) => {
            const next = event.target.value as AiProvider;
            setProvider(next);
            if (!model || Object.values(aiProviders).some((item) => item.model === model))
              setModel(aiProviders[next].model);
          }}
        >
          {(Object.keys(aiProviders) as AiProvider[]).map((item) => (
            <option key={item} value={item}>
              {aiProviders[item].name}
            </option>
          ))}
        </Select>
      </label>
      {provider === "compatible" && (
        <label className={labelClass}>
          {t("dialogs.aiApiUrl")}
          <Input
            type="url"
            required
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </label>
      )}
      <label className={labelClass}>
        {t("dialogs.aiApiKey")}
        <Input
          type="password"
          required={provider !== "compatible"}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label className={labelClass}>
        {t("dialogs.aiModel")}
        <Input
          required
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={provider === "anthropic" ? "claude-opus-5-5" : t("dialogs.aiModelPlaceholder")}
        />
      </label>
      <Hint>{t(provider === "anthropic" ? "dialogs.aiKeyHintClaude" : "dialogs.aiKeyHint")}</Hint>
      <div className={dialogFooterClass}>
        {settings && (
          <Button type="button" variant="danger" size="lg" onClick={() => onSave(null)}>
            {t("dialogs.aiRemoveKey")}
          </Button>
        )}
        <Button variant="secondary" size="lg" type="button" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary">{t("common.save")}</Button>
      </div>
    </Dialog>
  );
}
