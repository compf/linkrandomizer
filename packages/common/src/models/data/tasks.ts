export type Category = "Gaming" | "Real life" | "Brain training" | "Book" | "Internet" | "AI";

export type TaskEntry = {
  category: Category;
  year?: number;
  weekOfYear?: number;
};

export type TaskData = {
  tasks: Record<string, TaskEntry>;
};

/** Draft catalog — entries will change often; proposal logic stays stable. */
export const tasks: TaskData = {
  tasks: {
    "chess": {
      category: "Brain training",
    },
    "sudoku": {
      category: "Brain training",
    },

    "Harry potter game":{
        category: "Gaming",
    },
   
    "Zelda oracle of ages": {
      category: "Gaming",
    },
    "Mario & luigi superstar": {
      category: "Gaming",
    },
    "metroid zero mission": {
      category: "Gaming",
    },
    "zelda minish cap": {
      category: "Gaming",
    },
    "Super mario 3d world": {
      category: "Gaming",
    },
    "7 billion human": {
      category: "Gaming",
    },
    "Star wars jedi knight": {
      category: "Gaming",
    },
    "Donkey kong country tropical freeze": {
      category: "Gaming",
    },
    "Xenoblade chronicle x": {
      category: "Gaming",
    },
    "sword crazy moves": {
      category: "Gaming",
    },
    "Scralet cazy moves": {
      category: "Gaming",
    },
    "Yoshie crafted world": {
      category: "Gaming",
    },
    "Psword no exp": {
      category: "Gaming",
    },
    "Portal 2": {
      category: "Gaming",
    },
    "Zelda ocarina of time": {
      category: "Gaming",
    },
    "Scarlet metronome": {
      category: "Gaming",
    },
    "human resource machine": {
      category: "Gaming",
    },
    Skyrim: {
      category: "Gaming",
    },
    "Zelda link to the past": {
      category: "Gaming",
    },
    "metroid dread": {
      category: "Gaming",
    },
    "Super metroid": {
      category: "Gaming",
    },
    "mega man": {
      category: "Gaming",
    },
    "donkey kong land": {
      category: "Gaming",
    },
    "earthworm jim": {
      category: "Gaming",
    },
    "Yugi Oh": {
      category: "Gaming",
    },
    "Zelda Echoes of wisdom": {
      category: "Gaming",
    },
    "Mario wonder": {
      category: "Gaming",
    },
    "Zelda majoras mask": {
      category: "Gaming",
    },
    sonic: {
      category: "Gaming",
    },
    Heroki: {
      category: "Gaming",
    },
    "mario sunshine": {
      category: "Gaming",
    },
    "mario 64": {
      category: "Gaming",
    },
    "Mario maker": {
      category: "Gaming",
    },
    "BDSP No exp": {
      category: "Gaming",
    },
    "south park": {
      category: "Gaming",
    },
    fornite: {
      category: "Gaming",
    },
    "Pokemon unite": {
      category: "Gaming",
    },
    nexomon: {
      category: "Gaming",
    },
    "Bdsp crazy moves": {
      category: "Gaming",
    },
    "paper mario 1000 doors": {
      category: "Gaming",
    },
    "Scarlet no exp": {
      category: "Gaming",
    },
    "Splatoon 3": {
      category: "Gaming",
    },
    "metroid fusion": {
      category: "Gaming",
    },
    "mario odyssee": {
      category: "Gaming",
    },
    Minecraft: {
      category: "Gaming",
    },
    spyro: {
      category: "Gaming",
    },
    "paper mario n64": {
      category: "Gaming",
    },
    "lets go crazy moves": {
      category: "Gaming",
    },
    "mario galaxy": {
      category: "Gaming",
    },
    "lego harry potter": {
      category: "Gaming",
    },
    "Cities skyline": {
      category: "Gaming",
    },
    "Mario allstars": {
      category: "Gaming",
    },
    Deponia: {
      category: "Gaming",
    },
    "banjo kazooie": {
      category: "Gaming",
    },
    "Talos principle": {
      category: "Gaming",
    },
    "Yoshie island": {
      category: "Gaming",
    },
    "Pokmeon mystery dungeon": {
      category: "Gaming",
    },
    Kirby: {
      category: "Gaming",
    },
    "Zelda tears of the kingdom": {
      category: "Gaming",
    },
    "Legend arceus": {
      category: "Gaming",
    },
    "legend arceus crazy moves": {
      category: "Gaming",
    },
    "Mathe buch":{
      category: "Book",
    },
    "Physik buch":{
      category: "Book",
    },
    "newspapers.com":{
      category: "Internet",
    },
    "weser":{
      category: "Internet",
    },
    "reddit":{
      category: "Internet",
    },
    "youtube":{
      category: "Internet",
    },
    "twitter":{
      category: "Internet",
    },
    "claude":{
      category: "AI",
    },
    "chatgpt":{
      category: "AI",
    },
    "Astronomy":{category: "Real life"},
    "Clean room":{category: "Real life"},
    "Phyical experiments":{category: "Real life"},
    "Harry potter":{category: "Book"},
    "Brilliant":{category: "Brain training"},
   "känguru":{category: "Brain training"},
   "caluculating in head":{category: "Brain training"},
  
  },
};
