/** Class strings shared by the app's dialogs. */

/** A dialog's heading. */
export const dialogTitleClass = "mx-0 mt-0 mb-[22px] text-[20px]";

/** A label with its control (an `Input`, `Select`, `Textarea` or `FileButton`) under the text. */
export const fieldLabelClass = "flex flex-col gap-[7px] font-semibold";

/** A label with a `Checkbox` (or radio button) before the text. */
export const optionLabelClass = "flex flex-row items-center gap-2";

/** The row of buttons at the bottom of a dialog; its first button is the grey Cancel or Close. */
export const dialogFooterClass = "mt-6 flex justify-end gap-2";

/** Explanatory paragraphs of the longer dialogs (import, backup, sync). */
export const dialogIntroClass = "leading-normal text-ink-subtle";

/** The result of a dialog's action (import, backup, sync, settings); tests find it by `import-report`. */
export const plainReportClass = "import-report wrap-anywhere rounded-sm bg-brand-soft p-2.5";

/** `plainReportClass` among a dialog's intro paragraphs, in their color. */
export const reportClass = `${plainReportClass} ${dialogIntroClass}`;

/** A section of a dialog with a list of rows (trusted devices, snapshots, automatic backups). */
export const dialogListClass = "my-2.5 flex flex-col gap-1.5";

/** A framed block of the sync dialog for one way of syncing: heading, text, fields and a row of buttons. */
export const localSyncClass = {
  section: "mb-5 grid grid-cols-[minmax(0,1fr)] gap-2.5 rounded-lg border border-line p-3.5",
  text: "m-0 leading-[1.4] text-ink-subtle",
  actions: "flex flex-wrap gap-2",
};
