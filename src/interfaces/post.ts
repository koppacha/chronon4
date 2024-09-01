import { type Author } from "./author";

export type Post = {
  id: string;
  tags: any;
  categories: any;
  number: string;
  slug: string;
  title: string;
  date: string;
  coverImage: string;
  author: Author;
  excerpt: string;
  ogImage: {
    url: string;
  };
  content: string;
  preview?: boolean;
};
