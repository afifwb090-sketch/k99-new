export const formatIDR = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};


export const formatNumber = (value: number) => {
  return new Intl.NumberFormat("id-ID").format(value);
};


export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
};


export const formatDateTime = (date: string | Date) => {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};


export const generateId = () => {
  return crypto.randomUUID();
};


/**
 * Download data sebagai CSV
 */
export const downloadCSV = (
  data: any[],
  filename: string = "export.csv"
) => {

  if (!data || data.length === 0) {
    return;
  }


  const headers = Object.keys(data[0]);


  const csv = [
    headers.join(","),

    ...data.map(row =>
      headers
        .map(field => {
          const value = row[field] ?? "";

          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
  ].join("\n");


  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;"
    }
  );


  const url = URL.createObjectURL(blob);


  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);


  URL.revokeObjectURL(url);
};