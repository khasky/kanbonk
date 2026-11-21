import { Icon } from "../ui/Icon";

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
        <div className="notice-banner" role="status">
          {notice}
          {noticeCardId && (
            <button
              className="link-button"
              onClick={() => {
                onDismissNotice();
                onOpenCard(noticeCardId);
              }}
            >
              Open
            </button>
          )}
          <button onClick={onDismissNotice} aria-label="Dismiss message">
            <Icon name="close" />
          </button>
        </div>
      )}
      {backupAsk && (
        <div className="backup-ask" role="alertdialog" aria-label="Automatic backup">
          <span>An automatic backup is due. Your browser may ask where to save it.</span>
          <div>
            <button className="primary-button" onClick={onSaveBackup}>
              Save backup
            </button>
            <button className="link-button" onClick={onSkipBackup}>
              Skip
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={onDismissError} aria-label="Dismiss message">
            <Icon name="close" />
          </button>
        </div>
      )}
    </>
  );
}
