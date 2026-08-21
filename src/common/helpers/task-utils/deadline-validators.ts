import { BadRequestException } from '@nestjs/common';

import { deadlineMessageTwo } from '@/common/messages';

const isDeadlineAfterStartDate = (startDate: string, deadline: string) => {
  if (deadline <= startDate) throw new BadRequestException(deadlineMessageTwo);
};

export { isDeadlineAfterStartDate };
