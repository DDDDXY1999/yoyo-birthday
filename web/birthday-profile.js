const recipient = Object.freeze({ name: '悠悠', birthdayAge: 20, celebrationYear: 2026 });
export function getRecipient() { return recipient; }
export function cakeGreeting(profile){return Array.from(profile.name).length>12?profile.name:`${profile.name}，${profile.birthdayAge}岁快乐`;}
export function birthdayBlessing(profile){
  const {name,birthdayAge}=profile;
  return {
    title:`${name}，${birthdayAge}岁生日快乐`,
    dedication:`写给 ${name} · 属于你的第 ${birthdayAge} 岁`,
    paragraphs:[
      `今天你亲手挑好了喜欢的蛋糕，也把小小的愿望交给了烛光。${name}，这一整片星河，都是为你亮起的。`,
      `愿${birthdayAge}岁的你，依然有好奇心，也有做自己的勇气。开心时尽情笑，疲惫时放心停一停，不必急着成为谁期待的模样。`,
      '愿你被认真惦记，被温柔以待；愿生活里有小小的惊喜，身边有愿意听你说话的人。',
      '愿刚刚许下的心愿，在往后的日子里慢慢实现。新的一岁，平安、自由、明亮，也多爱自己一点。'
    ],
    closing:`${name}，今天的美好都属于你。`
  };
}
