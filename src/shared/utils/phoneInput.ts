/**
 * A phone number as typed into a sign-up or sign-in field, made into the one form the account is stored under.
 *
 * People write the same number as 0712 345 678, 0712-345-678, 254712345678 and +254 712 345 678. The server accepts
 * all of them, but sending one form keeps the sign-up request and the automatic sign-in that follows it identical, whatever
 * version of the server answers.
 */
export const toInternationalPhone = (raw: string | null | undefined): string => {
  const compact = (raw ?? "").replace(/[\s().-]/gu, "");
  if (/^0\d{9}$/u.test(compact)) {
    return `+254${compact.slice(1)}`;
  }
  if (/^254\d{9}$/u.test(compact)) {
    return `+${compact}`;
  }
  return compact;
};
