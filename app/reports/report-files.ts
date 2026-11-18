export async function copyReport(text: string, toast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    toast("보고서를 복사했습니다.");
  } catch {
    toast("복사하지 못했습니다. 글 안의 목록을 선택하세요.");
  }
}

export function downloadReport(csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
