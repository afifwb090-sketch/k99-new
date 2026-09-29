export const downloadProjectZip = () => {
  console.log("Download project zip");
};


export const downloadBackupJson = (data:any = {}) => {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type:"application/json"
    }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "backup.json";
  a.click();

  URL.revokeObjectURL(url);
};