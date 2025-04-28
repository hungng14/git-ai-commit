export const parseCustomJSONString = (str: string) => {
  try {
    let contentStr = str || '';

    contentStr = contentStr
      .replace('```html', '')
      .replace('```json', '')
      .replace(/```/g, '')
      .replace(/\n/g, '');
    // const cleanedString = contentStr.replace(/`([^`]+)`/g, (match, content) => {
    //   const escapedContent = content.replace(/\n/g, '\\n').replace(/"/g, '\\"');
    //   return `"${escapedContent}"`;
    // });

    const jsonObject = JSON.parse(contentStr);
    return jsonObject;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
};
