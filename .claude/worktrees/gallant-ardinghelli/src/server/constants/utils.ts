export const getTimestamp = () => {
  let now = new Date();
  return `${now.getDay()}/${now.getMonth()}/${now.getFullYear()}  ${now.getHours()}:${now.getMinutes()} `;
};
export const generateInvoiceID = () => {
  return Math.ceil(Math.random() * 15044332);
};

export const getDateAndHour = () => {
  let TodayDate = new Date();
  return `${TodayDate.getDate()}/${
    TodayDate.getMonth() + 1
  }/${TodayDate.getFullYear()} ${TodayDate.getHours()}:${TodayDate.getMinutes()}`;
};
