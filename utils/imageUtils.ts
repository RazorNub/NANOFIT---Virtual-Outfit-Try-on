export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const cleanBase64 = (base64Str: string): string => {
  return base64Str.split(',')[1] || base64Str;
};

export const getMimeType = (base64Str: string): string => {
  const match = base64Str.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
  if (match && match.length > 1) {
    return match[1];
  }
  return 'image/png'; // Default fallback
};