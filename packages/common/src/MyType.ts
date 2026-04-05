export type MyType = {
  id: number;
  name: string;
};

export const myFunction = (obj: MyType): string => {
  return `ID: ${obj.id}, Name: ${obj.name}`;
}