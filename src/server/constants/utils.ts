export const getTimestamp = () => {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth()}/${now.getFullYear()}  ${now.getHours()}:${now.getMinutes()} `;
};
export const generateInvoiceID = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ANC-${year}${month}-${random}`;
};

export const getDateAndHour = () => {
  const TodayDate = new Date();
  return `${TodayDate.getDate()}/${
    TodayDate.getMonth() + 1
  }/${TodayDate.getFullYear()} ${TodayDate.getHours()}:${TodayDate.getMinutes()}`;
};
