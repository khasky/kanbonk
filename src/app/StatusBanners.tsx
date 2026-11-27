import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { t } from "../i18n";

/** The messages over the app: a notice that may open a card, the automatic backup question and the last error. */
export function StatusBanners({
  notice,
  noticeCardId,
  onDismissNotice,
  onOpenCard,
  backupAsk,
  onSaveBackup,
  onSkipBackup,
  error,
  onDismissError,
}: {
  notice: string;
  noticeCardId?: string;
  onDismissNotice: () => void;
  onOpenCard: (id: string) => void;
  backupAsk: boolean;
  onSaveBackup: () => void;
  onSkipBackup: () => void;
  error: string;
  onDismissError: () => void;
}) {
  return (
    <>
      {notice && (
        <div
          className="fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-3.5 rounded-[5px] border border-[#4bce97] bg-[#dcfff1] px-3 py-2.5 text-[#164b35] shadow-popover"
          role="status"
        >
          {notice}
          {noticeCardId && (
            <Button
              variant="text"
              className="underline"
              onClick={() => {
                onDismissNotice();
                onOpenCard(noticeCardId);
              }}
            >
              {t("app.open")}
            </Button>
          )}
          <Button variant="text" onClick={onDismissNotice} aria-label={t("app.dismissMessage")}>
            <Icon name="close" />
          </Button>
        </div>
      )}
      {backupAsk && (
        <div
          className="fixed right-5 bottom-5 z-[110] grid max-w-[340px] gap-2.5 rounded-md border border-line bg-white px-3.5 py-3 text-[14px] text-ink shadow-popover"
          role="alertdialog"
          aria-label={t("app.automaticBackup")}
        >
          <span>{t("app.backupDue")}</span>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onSaveBackup}>
              {t("app.saveBackup")}
            </Button>
            <Button variant="link" onClick={onSkipBackup}>
              {t("app.skip")}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div
          className="absolute top-[49px] right-5 z-[110] flex gap-3.5 rounded-[5px] border border-[#f87168] bg-[#fef1ee] p-3 text-danger"
          role="alert"
        >
          {error}
          <Button variant="text" onClick={onDismissError} aria-label={t("app.dismissMessage")}>
            <Icon name="close" />
          </Button>
        </div>
      )}
    </>
  );
}
