import { askConfirm } from "../ui/AskDialog";
import { Dialog } from "../ui/Modal";
import { useEffect, useState } from "react";
import type { AppState } from "../model";
import {
  backupFolder,
  defaultAutoBackup,
  lastAutoBackup,
  loadAutoBackupSettings,
  saveAutoBackupSettings,
  setBackupFolder,
  writeAutoBackup,
  type AutoBackupSettings,
  type BackupFrequency,
} from "../backup/autoBackup";
import {
  backupFolderLabel,
  backupFolderSupported,
  defaultBackupDestination,
  pickBackupFolder,
  platform,
  type BackupFolder,
} from "../lib/platform";
import { setTrashRetention, trashRetentionChoices, useTrashRetention } from "../lib/trashRetention";
import { chooseLocale, chosenLocale, formatDateTime, type MessageKey, t } from "../i18n";
import { isLocaleCode, locales, matchLocale } from "../i18n/locales";
import { tNodes, useLocale } from "../i18n/nodes";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import {
  dialogFooterClass,
  dialogListClass,
  dialogTitleClass,
  fieldLabelClass,
  optionLabelClass,
  plainReportClass,
} from "./dialogLook";

const optionClass = `${optionLabelClass} font-normal`;

const frequencies: Array<[BackupFrequency, MessageKey]> = [
  ["6h", "settings.every6h"],
  ["day", "settings.everyDay"],
  ["week", "settings.everyWeek"],
  ["off", "settings.off"],
];

/** The interface language of this device: one of the supported languages, or the system's. */
function LanguageField() {
  useLocale();
  const chosen = chosenLocale();
  const system = matchLocale(navigator.languages ?? [navigator.language]);
  const systemName = locales.find((item) => item.code === system)?.name ?? system;
  return (
    <label className={fieldLabelClass}>
      {t("settings.language")}
      <Select
        value={chosen ?? ""}
        onChange={(event) => void chooseLocale(isLocaleCode(event.target.value) ? event.target.value : undefined)}
      >
        <option value="">{t("settings.languageSystem", { name: systemName })}</option>
        {locales.map((item) => (
          <option key={item.code} value={item.code} lang={item.code}>
            {item.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

/**
 * App settings: the interface language, where, how often and how many automatic full backups (data and files) are kept outside the app, and
 * how long deleted items stay in the trash.
 */
export function SettingsDialog({ getState, onClose }: { getState: () => AppState; onClose: () => void }) {
  const [settings, setSettings] = useState<AutoBackupSettings>(defaultAutoBackup);
  const [folder, setFolder] = useState<BackupFolder>();
  const [defaultLabel, setDefaultLabel] = useState<string>();
  const [last, setLast] = useState<string>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const retentionDays = useTrashRetention();

  useEffect(() => {
    void (async () => {
      setSettings(await loadAutoBackupSettings());
      setFolder(await backupFolder());
      setLast(await lastAutoBackup());
      setDefaultLabel((await defaultBackupDestination().catch(() => undefined))?.label);
    })();
  }, []);

  async function change(next: AutoBackupSettings) {
    setSettings(next);
    await saveAutoBackupSettings(next);
  }

  async function chooseFolder() {
    try {
      const picked = await pickBackupFolder();
      if (!picked) return;
      await setBackupFolder(picked);
      setFolder(picked);
      const next = { ...settings, target: "folder" as const };
      await change(next);
      const label = backupFolderLabel(picked);
      // Earlier backups are not moved: they stay where they were written.
      if (
        await askConfirm({
          title: t("settings.writeNowTitle", { folder: label }),
          message: t("settings.writeNowMessage"),
          confirm: t("settings.backUpNow"),
        })
      )
        await backupNow(next);
      else setStatus(t("settings.nextBackupTo", { folder: label }));
    } catch (cause) {
      setStatus(String(cause instanceof Error ? cause.message : cause));
    }
  }

  async function backupNow(current = settings) {
    setBusy(true);
    setStatus(t("settings.writing"));
    try {
      setStatus(t("settings.writtenTo", { report: await writeAutoBackup(getState(), current, true) }));
      setLast(await lastAutoBackup());
    } catch (cause) {
      setStatus(String(cause instanceof Error ? cause.message : cause));
    } finally {
      setBusy(false);
    }
  }

  const available = Boolean(defaultLabel) || backupFolderSupported;
  return (
    <Dialog label={t("settings.title")} onDismiss={busy ? undefined : onClose}>
      <h2 className={dialogTitleClass}>{t("settings.title")}</h2>
      <section className={dialogListClass}>
        <LanguageField />
        <Hint>{t("settings.languageHint")}</Hint>
      </section>
      <section className={dialogListClass}>
        <h3>{t("settings.backupsTitle")}</h3>
        {platform === "extension" && <Hint>{t("settings.extensionHint")}</Hint>}
        {available ? (
          <>
            <p>{t("settings.backupIntro")}</p>
            <label className={fieldLabelClass}>
              {t("settings.frequency")}
              <Select
                value={settings.frequency}
                onChange={(event) => void change({ ...settings, frequency: event.target.value as BackupFrequency })}
              >
                {frequencies.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset className="m-0 grid gap-2 rounded-md border border-line px-3 pt-2 pb-3">
              <legend className="px-1 font-semibold">{t("settings.location")}</legend>
              {defaultLabel && (
                <label className={optionClass}>
                  <Checkbox
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "default"}
                    onChange={() => void change({ ...settings, target: "default" })}
                  />
                  <span className="wrap-anywhere">
                    {tNodes("settings.defaultLocation", { place: <strong>{defaultLabel}</strong> })}
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <label className={optionClass}>
                  <Checkbox
                    type="radio"
                    name="backup-target"
                    checked={settings.target === "folder"}
                    disabled={!folder}
                    onChange={() => void change({ ...settings, target: "folder" })}
                  />
                  <span className="wrap-anywhere">
                    {tNodes("settings.folderLocation", {
                      place: <strong>{folder ? backupFolderLabel(folder) : t("settings.notChosen")}</strong>,
                    })}
                  </span>
                </label>
              )}
              {backupFolderSupported && (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="justify-self-start"
                  onClick={() => void chooseFolder()}
                  disabled={busy}
                >
                  {folder ? t("settings.chooseAnotherFolder") : t("settings.chooseFolder")}
                </Button>
              )}
              {platform === "web" && settings.target === "default" && <Hint>{t("settings.webDownloadsHint")}</Hint>}
            </fieldset>
            <label className={optionClass}>
              {tNodes("settings.keepNewest", {
                field: (
                  <Input
                    size="sm"
                    className="w-[72px]"
                    type="number"
                    min={1}
                    max={100}
                    value={settings.keep}
                    onChange={(event) => {
                      const keep = Number(event.target.value);
                      if (Number.isInteger(keep) && keep >= 1 && keep <= 100) void change({ ...settings, keep });
                    }}
                  />
                ),
              })}
            </label>
            <Hint>{t("settings.lastBackup", { time: last ? formatDateTime(last) : t("settings.noneYet") })}</Hint>
            <Button
              type="button"
              variant="primary"
              onClick={() => void backupNow()}
              disabled={busy || (settings.target === "folder" && !folder)}
            >
              {busy ? t("common.pleaseWait") : t("settings.backUpNow")}
            </Button>
          </>
        ) : (
          <p>{t("settings.unavailable")}</p>
        )}
        {status && (
          <p className={plainReportClass} role="status">
            {status}
          </p>
        )}
      </section>
      <section className={dialogListClass}>
        <h3>{t("settings.trashTitle")}</h3>
        <label className={fieldLabelClass}>
          {t("settings.trashAfter")}
          <Select
            value={retentionDays ?? ""}
            disabled={retentionDays === undefined}
            onChange={(event) =>
              void setTrashRetention(Number(event.target.value)).catch((cause) => setStatus(String(cause)))
            }
          >
            {trashRetentionChoices.map((days) => (
              <option key={days} value={days}>
                {t("common.days", { count: days })}
              </option>
            ))}
          </Select>
        </label>
        <Hint>{t("settings.trashHint")}</Hint>
      </section>
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" type="button" onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}
