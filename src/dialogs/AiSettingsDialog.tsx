import { Modal, submitWith } from "../ui/Modal";
import { useState } from "react";
import { aiProviders, type AiProvider, type AiSettings } from "../ai";

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
    <Modal
      label="AI settings"
      className="creation-dialog ai-settings"
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
      <h2>AI assistant</h2>
      <label>
        Provider
        <select
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
        </select>
      </label>
      {provider === "compatible" && (
        <label>
          API URL
          <input
            type="url"
            required
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </label>
      )}
      <label>
        API key
        <input
          type="password"
          required={provider !== "compatible"}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Model
        <input
          required
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={provider === "anthropic" ? "claude-opus-5-5" : "Model name at the provider"}
        />
      </label>
      <p className="hint">
        The key is stored only in this browser (never synced, never in backups). Board data is sent to the provider only
        when you click an AI action button.
        {provider === "anthropic" ? " Claude models use a server-side fallback in case the model refuses." : ""}
      </p>
      <div>
        {settings && (
          <button type="button" className="danger-button" onClick={() => onSave(null)}>
            Remove key
          </button>
        )}
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button">Save</button>
      </div>
    </Modal>
  );
}
