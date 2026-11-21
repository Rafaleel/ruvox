/** The three alphabet groups, in the order a learner meets them. */
export const LETTER_GROUPS: Record<
  number,
  { title: string; hint: string; description: string }
> = {
  1: {
    title: "Grupo 1: iguais ao português",
    hint: "iguais às nossas",
    description: "Você já conhece a forma e o som. Comece por aqui.",
  },
  2: {
    title: "Grupo 2: parecem latinas, mas soam diferente",
    hint: "parecem, mas não são",
    description: "Cuidado: a forma engana. O som é outro.",
  },
  3: {
    title: "Grupo 3: letras novas",
    hint: "letras novas",
    description: "Formas que você ainda não viu. Uma de cada vez.",
  },
};
