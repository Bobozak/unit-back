import { differenceInDays } from 'date-fns';

export const getDifferenceInDays = (deadline: string, startDate: string) => {
  const localStartDate = new Date(startDate);
  const localDeadline = new Date(deadline);

  localStartDate.setUTCHours(0, 0, 0, 0);
  localDeadline.setUTCHours(0, 0, 0, 0);

  return differenceInDays(localDeadline, localStartDate);
};
