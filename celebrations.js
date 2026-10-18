/**
 * 日日新 · 专注后庆祝清单
 *
 * 来源：《福格行为模型》附录「100 种庆祝方式」，取其中适合学习场景的 59 种。
 * 三条原则：即时（结束那几秒就做）、真实（尴尬就换一个）、一种就够。
 *
 * 想增加庆祝方式：直接在 RRX_CELEBRATIONS 里加一行即可，不需要改 app.js。
 *   { id: 100, group: 'A', text: '拍拍自己的头，说「辛苦了」。' }
 *   id 只用来避免短期重复，填一个没用过的数字就行；
 *   group 用下面 A–I 中的任意一组，决定图标、颜色与提示语。
 *
 * 想增加分组：在 RRX_CELEBRATION_GROUPS 里补一项，再在 index.html 的
 * <defs> 里补一个同名图标（i-<icon>）。
 */
(function (global) {
  'use strict';

  global.RRX_CELEBRATION_GROUPS = {
    A: {
      name: '短句宣言',
      icon: 'sparkles',
      color: '#e7bd72',
      cue: '说出口，或只在心里说。',
    },
    B: {
      name: '给自己撑腰',
      icon: 'flame',
      color: '#db8a6a',
      cue: '这句话，只说给自己听。',
    },
    C: {
      name: '表情与目光',
      icon: 'smile',
      color: '#e2a78c',
      cue: '现在，就做这个表情。',
    },
    D: {
      name: '手与拳的爆发',
      icon: 'star',
      color: '#e5b364',
      cue: '让身体先高兴起来。',
    },
    E: {
      name: '掌 · 指 · 肩颈',
      icon: 'leaf',
      color: '#a8c6aa',
      cue: '轻轻的，不吵醒同桌。',
    },
    F: {
      name: '声音与音乐',
      icon: 'music',
      color: '#9dbbcb',
      cue: '有声音，也可以只在心里响。',
    },
    G: {
      name: '假装自己是冠军',
      icon: 'crown',
      color: '#ecc66f',
      cue: '摆出那个姿势，三秒。',
    },
    H: {
      name: '想象中的那个人',
      icon: 'heart',
      color: '#dda39b',
      cue: '让那个人，为你高兴一下。',
    },
    I: {
      name: '画面 · 气味 · 光',
      icon: 'sun',
      color: '#e8d7a1',
      cue: '闭上眼，三秒就够。',
    },
  };

  global.RRX_CELEBRATIONS = [
    /* A · 短句宣言（图书馆、自习室都能做） */
    { id: 21, group: 'A', text: '握紧拳头，说「nice！」' },
    { id: 25, group: 'A', text: '对自己说「干得好！」' },
    { id: 48, group: 'A', text: '说「你做到了！」' },
    { id: 51, group: 'A', text: '说「真好！」然后点点头' },
    { id: 93, group: 'A', text: '说「好极了！」' },

    /* B · 给自己撑腰（刚啃完一章、正怀疑自己时用） */
    { id: 17, group: 'B', text: '说「我说到做到了！」' },
    { id: 20, group: 'B', text: '说「我搞定了！」' },
    { id: 29, group: 'B', text: '对自己说「没错！我很擅长培养习惯。」' },
    { id: 37, group: 'B', text: '在心里告诉自己「是的，我能行！」' },
    { id: 57, group: 'B', text: '赞美自己「我很擅长……」' },
    { id: 59, group: 'B', text: '吐一口气，然后说「nice！」' },
    { id: 63, group: 'B', text: '拉长尾音，说「nice——！」' },
    { id: 64, group: 'B', text: '心想「做得好！」' },
    { id: 71, group: 'B', text: '说「达阵！」然后像裁判一样举起双手' },
    { id: 15, group: 'B', text: '心想「没错，我快要成功地做出改变了！」' },

    /* C · 表情与目光（全程零声响，任何场合都安全） */
    { id: 7, group: 'C', text: '展露一个大大的微笑' },
    { id: 49, group: 'C', text: '扬起下巴，对着远方微笑' },
    { id: 86, group: 'C', text: '露出灿烂的笑容，并欢呼「耶！耶！」' },
    { id: 9, group: 'C', text: '画一个笑脸，感受它传递的情绪' },

    /* D · 手与拳的爆发（合书后一秒完成） */
    { id: 8, group: 'D', text: '双手比赞' },
    { id: 32, group: 'D', text: '握拳，敲打心脏位置 3 次' },
    { id: 40, group: 'D', text: '高兴地搓搓手' },
    { id: 42, group: 'D', text: '双手握拳，碰到一起后像炸开一样' },
    { id: 43, group: 'D', text: '给自己击掌' },
    { id: 60, group: 'D', text: '骄傲地拍拍肩膀' },
    { id: 61, group: 'D', text: '为自己鼓掌' },

    /* E · 掌 · 指 · 肩颈（不吵醒同桌） */
    { id: 46, group: 'E', text: '打响指' },
    { id: 14, group: 'E', text: '稍微按摩一下肩膀或脖子' },
    { id: 2, group: 'E', text: '轻轻敲击墙面或桌面，奏出轻快的节拍' },
    { id: 58, group: 'E', text: '用口哨吹出轻快的旋律' },

    /* F · 声音与音乐（走路回家、宿舍里最合适） */
    { id: 10, group: 'F', text: '哼几句轻快的歌词' },
    { id: 79, group: 'F', text: '边走边唱「S-U-C-C-E-S-S！」这就是我拼写「成功」的方式' },
    { id: 45, group: 'F', text: '模仿玛莎·斯图尔特的语气说「这很不错。」' },
    { id: 44, group: 'F', text: '听听脑海里的号角声' },
    { id: 76, group: 'F', text: '想象老虎机中头奖时发出的声音' },
    { id: 24, group: 'F', text: '听到人群欢呼' },
    { id: 50, group: 'F', text: '想象掌声雷动' },

    /* G · 假装自己是冠军（需要一股「我很能打」的气势时） */
    { id: 5, group: 'G', text: '假装投进三分球' },
    { id: 95, group: 'G', text: '做出一个和平的手势，说（或想）「胜利了！」' },
    { id: 89, group: 'G', text: '张开双臂，想象自己正在拥抱改变' },
    { id: 19, group: 'G', text: '撒出想象中五彩缤纷的小纸片' },
    { id: 12, group: 'G', text: '举起双手，摆出胜利的姿势，同时说「胜利！」' },

    /* H · 想象中的那个人在为你高兴（一个人自习最补能量） */
    { id: 3, group: 'H', text: '想象妈妈给了你一个大大的拥抱' },
    { id: 11, group: 'H', text: '想想你最喜欢的老师对你说「你做得很好！」' },
    { id: 13, group: 'H', text: '想想你最好的朋友为你感到高兴' },
    { id: 33, group: 'H', text: '想象一位老师为你颁奖' },
    { id: 34, group: 'H', text: '想象你的孩子在冲着你笑' },
    { id: 41, group: 'H', text: '想象父亲对你说「哇！你太优秀了！」' },
    { id: 62, group: 'H', text: '想象你爱的人给了你一个大大的拥抱' },
    { id: 66, group: 'H', text: '想象看到爱人时自己的表情' },
    { id: 75, group: 'H', text: '和你的孩子击掌' },
    { id: 81, group: 'H', text: '想想你和宠物狗一起玩耍时的美好感觉' },

    /* I · 画面 · 气味 · 光（闭眼三秒即可） */
    { id: 6, group: 'I', text: '想象烟花为你而绽放' },
    { id: 73, group: 'I', text: '想象自己正在最喜欢的海滩上' },
    { id: 94, group: 'I', text: '想象你有一条尾巴，欢快地摇来摇去' },
    { id: 98, group: 'I', text: '想象自己身上有一圈闪闪发光的光环' },
    { id: 69, group: 'I', text: '深吸一口气，想象自己吸收了能量' },
    { id: 26, group: 'I', text: '双手合十，表示感谢' },
    { id: 52, group: 'I', text: '休息一下，深呼吸，感恩你的成功' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
