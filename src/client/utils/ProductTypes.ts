export interface featuredDataModel {
  bigAnnouncement: {
    background: string;
    title: string;
  };
  subTitle: string;
  title: string;
  text: string;
  image: string;
  featureThings: {
    [key: string]: {
      image: string;
      title: string;
      text: string;
    };
  };
  actionButton: {
    textButton: string;
    link: string;
  };
}

export interface contentProps {
  content: featuredDataModel;
}
