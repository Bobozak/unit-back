const unitNameRegex =
  /^(?!.*[!@#\$%^&*_+\-=~?]{2,})[A-Za-z0-9!@#\$%^&*_+\-=~?]{4,20}$/i;

const taskerUnitnameRegex = /^[a-zA-Z0-9]{3,}$/;

const taskTitleRegex = /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+$/;

const noteTextRegex =
  /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\n\r\t]+$/;

/** Rejects Cyrillic and related Cyrillic-script characters. */
const noCyrillicRegex = /^[^\u0400-\u04FF\u0500-\u052F]*$/;

export {
  noCyrillicRegex,
  noteTextRegex,
  taskerUnitnameRegex,
  taskTitleRegex,
  unitNameRegex,
};
