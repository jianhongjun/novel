'use client';

import { useState, Suspense, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getChapterList, getChapterContent, getUserId, getBookInfo } from '../../../lib/api';
import { getStaticLink } from '../../../lib/staticLink';
import common from '../../styles/common.module.css';
import styles from './page.module.css';

function ReadContent() {
  const searchParams = useSearchParams();
  const [showBookmarkBar, setShowBookmarkBar] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [chapter, setChapter] = useState<{
    id: string;
    ccid: string;
    title: string;
    content: string;
    nextCcid?: string;
  } | null>(null);
  const [allChapters, setAllChapters] = useState<Array<{
    id: string;
    ccid: string;
    title: string;
    content: string;
    chapterOrder: number;
  }>>([]); // 存储所有已加载的章节内容
  const [loading, setLoading] = useState(true);
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextChapter, setHasNextChapter] = useState(false); // 用于跟踪是否有下一章
  const [bookTitle, setBookTitle] = useState<string | null>(null); // 存储书名，用于设置页面标题
  const contentRef = useRef<HTMLDivElement>(null);
  const loadingNextRef = useRef(false); // 用于防止重复加载
  const nextCcidRef = useRef<string | undefined>(undefined); // 用于存储最新的下一章ID
  const lastLoadTimeRef = useRef<number>(0); // 记录上次加载时间，防止频繁触发
  const previousChapterIdRef = useRef<string | null>(null); // 存储上一章节ID
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null); // 30秒定时器

  const bookId = searchParams.get('id') as string; // cbid
  const chapterIdFromUrl = searchParams.get('chapter'); // 从URL获取章节ID
  
  // 从URL参数获取来源，默认为 source1（第一种样式）
  const source = searchParams.get('source') || 'source2';

  // 计算阅读进度
  const calculateProgress = (): number => {
    if (!contentRef.current) return 0;
    
    const content = contentRef.current;
    const scrollTop = content.scrollTop;
    const scrollHeight = content.scrollHeight;
    const clientHeight = content.clientHeight;
    
    if (scrollHeight <= clientHeight) return 100;
    
    const progress = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    return Math.min(100, Math.max(0, progress));
  };

  // 更新书签记录（静默更新，不显示提示）
  const updateBookmark = useCallback((chapterData: {
    ccid: string;
    title: string;
  }) => {
    try {
      const userId = getUserId();
      const progress = calculateProgress();
      
      const bookmark = {
        bookId,
        chapterId: chapterData.ccid,
        chapterTitle: chapterData.title,
        progress,
        timestamp: Date.now()
      };

      // 获取现有的书签列表
      const bookmarksKey = `bookmarks_${userId}_${bookId}`;
      const existingBookmarks = localStorage.getItem(bookmarksKey);
      let bookmarks: typeof bookmark[] = [];
      
      if (existingBookmarks) {
        bookmarks = JSON.parse(existingBookmarks);
      }

      // 检查是否已存在该章节的书签，如果存在则更新，否则添加
      const existingIndex = bookmarks.findIndex(b => b.chapterId === chapterData.ccid);
      if (existingIndex >= 0) {
        bookmarks[existingIndex] = bookmark;
      } else {
        bookmarks.push(bookmark);
      }

      // 保存到 localStorage
      localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
      
      // 同时保存当前阅读位置（用于快速跳转）
      const currentReadingKey = `currentReading_${userId}_${bookId}`;
      localStorage.setItem(currentReadingKey, JSON.stringify({
        chapterId: chapterData.ccid,
        chapterTitle: chapterData.title,
        progress,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('更新书签失败:', error);
    }
  }, [bookId]);

  // 获取书籍信息（用于设置页面标题）
  useEffect(() => {
    const fetchBookTitle = async () => {
      if (!bookId) return;
      
      try {
        const bookInfo = await getBookInfo(bookId);
        setBookTitle(bookInfo.title);
      } catch (err) {
        console.error('获取书籍信息失败:', err);
      }
    };

    fetchBookTitle();
  }, [bookId]);

  // 动态设置页面标题
  useEffect(() => {
    if (bookTitle) {
      // 如果URL中有chapter参数且章节已加载，显示章节标题
      if (chapterIdFromUrl && chapter && chapter.title) {
        document.title = `<<${bookTitle}>>-微米小说-${chapter.title}`;
      } else {
        document.title = `<<${bookTitle}>>-微米小说`;
      }
    } else {
      document.title = '微米小说';
    }

    // 组件卸载时恢复默认标题
    return () => {
      document.title = '微米小说';
    };
  }, [bookTitle, chapter, chapterIdFromUrl]);

  // 检查书签数据（进入页面时检查，仅用于日志输出，不自动跳转）
  useEffect(() => {
    if (!bookId) return;
    
    try {
      const userId = getUserId();
      const bookmarksKey = `bookmarks_${userId}_${bookId}`;
      const bookmarks = localStorage.getItem(bookmarksKey);
      
      if (bookmarks) {
        const bookmarkList = JSON.parse(bookmarks);
        //console.log('书签数据:', bookmarkList);
      } else {
        console.log('没有找到书签数据');
      }
    } catch (error) {
      console.error('检查书签数据失败:', error);
    }
  }, [bookId]);

  // 调用章节列表和内容接口
  useEffect(() => {
    const fetchChapterData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let targetCcid = chapterIdFromUrl; // 优先使用URL中的章节ID
        
        // 如果没有URL参数，先检查书签记录
        if (!targetCcid) {
          try {
            const userId = getUserId();
            const bookmarksKey = `bookmarks_${userId}_${bookId}`;
            const bookmarks = localStorage.getItem(bookmarksKey);
            
            if (bookmarks) {
              const bookmarkList = JSON.parse(bookmarks);
              if (bookmarkList && bookmarkList.length > 0) {
                // 找到最新的书签（按 timestamp 排序）
                const sortedBookmarks = bookmarkList.sort((a: { timestamp: number }, b: { timestamp: number }) => 
                  (b.timestamp || 0) - (a.timestamp || 0)
                );
                const latestBookmark = sortedBookmarks[0];
                if (latestBookmark && latestBookmark.chapterId) {
                  targetCcid = latestBookmark.chapterId;
                  // 使用 window.location.replace 实现完全隔离（整页重新加载）
                  window.location.replace(getStaticLink(`/book/read?id=${bookId}&chapter=${targetCcid}`));
                  return; // 跳转后不再执行后续逻辑
                }
              }
            }
          } catch (error) {
            console.error('检查书签记录失败:', error);
            // 如果检查书签失败，继续执行下面的逻辑（获取第一章节）
          }
        }
        
        // 如果没有URL参数且没有书签记录，则获取章节列表，取第一条
        if (!targetCcid) {
          // 第一步：获取章节列表
          const chapterListData = await getChapterList({
            cbid: bookId,
            pageNum: 1,
            pageSize: 20
          });
          
          // 过滤出 chapterType 为 -1 或 1 的章节，取第一条
          const filteredChapters = chapterListData.resultData.filter(
            chapter => chapter.chapterType === -1 || chapter.chapterType === 1
          );
          
          if (filteredChapters.length > 0) {
            const firstChapter = filteredChapters[0];
            targetCcid = firstChapter.ccid;
          } else {
            setError('没有找到符合条件的章节（chapterType 为 -1 或 1）');
            setLoading(false);
            return;
          }
        }
        
        if (targetCcid) {
          // 第二步：获取章节内容
          const chapterContentData = await getChapterContent({
            cbid: bookId,
            ccid: targetCcid
          });
          
          // 更新章节数据
          const newChapter = {
            id: chapterContentData.ccid,
            ccid: chapterContentData.ccid,
            title: chapterContentData.chapterTitle || '',
            content: chapterContentData.content || '',
            nextCcid: chapterContentData.nextCcid
          };
          setChapter(newChapter);
          // 初始化所有章节列表
          setAllChapters([{
            id: newChapter.ccid,
            ccid: newChapter.ccid,
            title: newChapter.title,
            content: newChapter.content,
            chapterOrder: chapterContentData.chapterOrder || 0
          }]);
          
          // 第一个章节不需要广告，所以不需要初始化
          // 更新 ref 和 state
          nextCcidRef.current = chapterContentData.nextCcid;
          setHasNextChapter(!!chapterContentData.nextCcid);
          
          // 清除之前的定时器
          if (progressTimerRef.current) {
            clearTimeout(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          
          // 自动存储书签和当前阅读位置（打开章节时 progress 为 0）
          setTimeout(() => {
            try {
              const userId = getUserId();
              const progress = 0; // 打开章节时，progress 为 0
              
              // 存储当前阅读位置
              const currentReadingKey = `currentReading_${userId}_${bookId}`;
              localStorage.setItem(currentReadingKey, JSON.stringify({
                chapterId: newChapter.ccid,
                chapterTitle: newChapter.title,
                progress,
                timestamp: Date.now()
              }));
              
              // 自动添加到书签列表
              const bookmarksKey = `bookmarks_${userId}_${bookId}`;
              const existingBookmarks = localStorage.getItem(bookmarksKey);
              let bookmarks: Array<{
                bookId: string;
                chapterId: string;
                chapterTitle: string;
                progress: number;
                timestamp: number;
              }> = [];
              
              if (existingBookmarks) {
                bookmarks = JSON.parse(existingBookmarks);
              }
              
              // 检查是否已存在该章节的书签，如果存在则更新，否则添加
              const bookmark = {
                bookId,
                chapterId: newChapter.ccid,
                chapterTitle: newChapter.title,
                progress,
                timestamp: Date.now()
              };
              
              const existingIndex = bookmarks.findIndex(b => b.chapterId === newChapter.ccid);
              if (existingIndex >= 0) {
                bookmarks[existingIndex] = bookmark;
              } else {
                bookmarks.push(bookmark);
              }
              
              // 保存书签列表
              localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
              
              // 启动 30 秒定时器，更新当前章节的 progress
              progressTimerRef.current = setTimeout(() => {
                try {
                  const currentProgress = calculateProgress();
                  const currentChapterId = newChapter.ccid;
                  
                  // 检查是否还在当前章节（防止已经翻到下一章了）
                  const currentReading = localStorage.getItem(currentReadingKey);
                  if (currentReading) {
                    const reading = JSON.parse(currentReading);
                    if (reading.chapterId === currentChapterId) {
                      // 更新当前阅读位置
                      localStorage.setItem(currentReadingKey, JSON.stringify({
                        chapterId: currentChapterId,
                        chapterTitle: newChapter.title,
                        progress: currentProgress,
                        timestamp: Date.now()
                      }));
                      
                      // 更新书签列表中的进度
                      const updatedBookmarks = localStorage.getItem(bookmarksKey);
                      if (updatedBookmarks) {
                        const bookmarkList = JSON.parse(updatedBookmarks);
                        const bookmarkIndex = bookmarkList.findIndex((b: { chapterId: string }) => b.chapterId === currentChapterId);
                        if (bookmarkIndex >= 0) {
                          bookmarkList[bookmarkIndex] = {
                            ...bookmarkList[bookmarkIndex],
                            progress: currentProgress,
                            timestamp: Date.now()
                          };
                          localStorage.setItem(bookmarksKey, JSON.stringify(bookmarkList));
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error('30秒后更新进度失败:', error);
                }
              }, 30000); // 30秒
            } catch (error) {
              console.error('更新阅读记录失败:', error);
            }
          }, 100);
        }
      } catch (err) {
        console.error('获取章节数据失败:', err);
        setError(err instanceof Error ? err.message : '获取章节数据失败');
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      fetchChapterData();
    }
  }, [bookId, chapterIdFromUrl, updateBookmark]);

  // 检查是否显示书签栏（检查用户是否手动点击过"加入书签收藏"或关闭过弹框）
  useEffect(() => {
    if (!chapter) {
      return;
    }
    
    const checkBookmark = () => {
      try {
        const userId = getUserId();
        // 检查用户是否手动点击过"加入书签收藏"按钮
        const bookmarkClickedKey = `bookmark_clicked_${userId}_${bookId}`;
        const hasClickedBookmark = localStorage.getItem(bookmarkClickedKey);
        
        // 检查用户是否关闭过书签栏
        const bookmarkClosedKey = `bookmark_closed_${userId}_${bookId}`;
        const hasClosedBookmark = localStorage.getItem(bookmarkClosedKey);
        
        // 如果用户已经点击过"加入书签收藏"或关闭过弹框，则不显示书签栏
        if (hasClickedBookmark === 'true' || hasClosedBookmark === 'true') {
          setShowBookmarkBar(false);
        } else {
          // 如果用户还没点击过且没关闭过，显示书签栏
          setShowBookmarkBar(true);
        }
      } catch (error) {
        console.error('检查书签失败:', error);
        // 出错时默认显示书签栏
        setShowBookmarkBar(true);
      }
    };

    checkBookmark();
  }, [bookId, chapter]);

  // 检查并滚动到记录的阅读位置
  useEffect(() => {
    if (!chapter || !contentRef.current || loading) return;

    try {
      const userId = getUserId();
      const currentReadingKey = `currentReading_${userId}_${bookId}`;
      const currentReading = localStorage.getItem(currentReadingKey);
      
      if (currentReading) {
        const reading = JSON.parse(currentReading);
        
        // 检查是否是当前章节，并且有进度记录
        if (reading.chapterId === chapter.ccid && reading.progress !== undefined) {
          // 等待内容完全渲染后再滚动
          setTimeout(() => {
            if (!contentRef.current) return;
            
            const content = contentRef.current;
            const scrollHeight = content.scrollHeight;
            const clientHeight = content.clientHeight;
            
            // 如果内容不可滚动，不需要滚动
            if (scrollHeight <= clientHeight) return;
            
            // 根据进度百分比计算滚动位置
            const progress = Math.min(100, Math.max(0, reading.progress));
            const maxScrollTop = scrollHeight - clientHeight;
            const targetScrollTop = (progress / 100) * maxScrollTop;
            
            // 滚动到目标位置
            content.scrollTop = targetScrollTop;
          }, 200); // 延迟200ms确保内容已完全渲染
        }
      }
    } catch (error) {
      console.error('恢复阅读位置失败:', error);
    }
  }, [chapter?.ccid, loading, bookId]);

  // 章节页SDK初始化（使用全局 window.TencentGDT）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).TencentGDT = (window as any).TencentGDT || [];
    console.log('章节页：已声明/保持 window.TencentGDT');
  }, []);

  // 初始化章节广告（参考 b.html 的简单直接方式）
  const initChapterAd = useCallback((containerId: string) => {
    if (typeof window === 'undefined') return;
    
    // 防止重复初始化
    const guardKey = `__chapter_ad_inited_${containerId}`;
    if ((window as any)[guardKey]) {
      console.log('章节广告已初始化，跳过:', containerId);
      return;
    }
    
    const gdt = (window as any).TencentGDT;
    const placement_id = '7235826098733219';
    
    // 确保全局命名空间已申明
    if (!gdt) {
      (window as any).TencentGDT = [];
    }
    
    // 检查 SDK 状态（用于日志）
    console.log('=== 章节页 SDK 状态检查 ===');
    console.log('TencentGDT:', gdt);
    console.log('isArray:', Array.isArray(gdt));
    console.log('hasNATIVE:', !!(gdt?.NATIVE));
    console.log('queueLength:', Array.isArray(gdt) ? gdt.length : 0);
    
    // 标记已初始化
    (window as any)[guardKey] = true;
    
    // 3.1.2 广告位申明：先push进入队列（参考 b.html，直接 push，不管 SDK 是否已加载）
    if (Array.isArray(gdt)) {
      console.log('✅ 章节广告push进入队列，容器:', containerId);
      
      gdt.push({
        app_id: '1213013256',
        placement_id: '7235826098733219',
        type: 'native',
        muid_type: '1',
        count: 1,
        onComplete: function(res: any) {
          console.log('=== 章节页广告回调 onComplete ===');
          console.log('广告回调:', res);
          
          // 等待容器存在后再渲染
          let retryCount = 0;
          const maxRetries = 50;
          
          const waitForContainer = () => {
            retryCount++;
            const container = document.getElementById(containerId);
            
            if (!container) {
              if (retryCount >= maxRetries) {
                console.log('等待章节广告容器超时，放弃渲染，容器:', containerId);
                return;
              }
              setTimeout(waitForContainer, 100);
              return;
            }
            
            // 处理数组格式的返回
            if (res && res.constructor === Array && res.length > 0) {
              try {
                (window as any).TencentGDT.NATIVE.renderAd(res[0], containerId);
                console.log('✅ 章节页广告渲染完成');
              } catch (e) {
                console.error('章节页广告渲染失败:', e);
              }
            } 
            // 处理对象格式的返回（新版本 SDK）
            else if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
              try {
                (window as any).TencentGDT.NATIVE.renderAd(res.data[0], containerId);
                console.log('✅ 章节页广告渲染完成 (data)');
              } catch (e) {
                console.error('章节页广告渲染失败 (data):', e);
              }
            } 
            // 无广告返回，使用 loadAd 重新拉取
            else {
              console.log('无广告或请求失败，使用 loadAd 重新拉取');
              setTimeout(function() {
                try {
                  // 检查容器是否还存在（可能页面已卸载）
                  const container = document.getElementById(containerId);
                  if (!container) {
                    console.log('章节广告容器不存在（可能页面已卸载），放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 window.TencentGDT 是否存在（可能已被清理）
                  if (!(window as any).TencentGDT) {
                    console.log('window.TencentGDT 不存在（可能已被清理），放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 NATIVE 是否存在
                  if (!(window as any).TencentGDT.NATIVE) {
                    console.log('window.TencentGDT.NATIVE 不存在，放弃 loadAd 调用');
                    return;
                  }
                  
                  // 检查 loadAd 方法是否存在
                  if (typeof (window as any).TencentGDT.NATIVE.loadAd !== 'function') {
                    console.log('loadAd 方法不存在，放弃调用');
                    return;
                  }
                  
                  (window as any).TencentGDT.NATIVE.loadAd(placement_id);
                  console.log('✅ 章节页 loadAd 调用成功');
                } catch (e2) {
                  console.error('章节页广告 loadAd 失败:', e2);
                }
              }, 3000);
            }
          };
          
          waitForContainer();
        },
        onError: function(err: any) {
          console.error('❌ 章节页广告请求出错:', err);
        }
      });
      
      console.log('✅ 章节广告push已进入队列，容器:', containerId, '队列长度:', gdt.length);
      console.log('push 的配置:', {
        app_id: '1213013256',
        placement_id: '7235826098733219',
        type: 'native',
        hasOnComplete: true,
        hasOnError: true
      });
    } else {
      console.error('❌ TencentGDT 不是数组，无法 push，当前状态:', {
        type: typeof gdt,
        isArray: Array.isArray(gdt),
        hasNATIVE: !!(gdt?.NATIVE),
        constructor: gdt?.constructor?.name
      });
    }
    
    // 3.1.3 加载H5 SDK（在push之后加载，确保push已进入队列）
    // 章节页独立管理，只检查章节页自己的标记
    const sdkInitKey = '__chapter_sdk_inited';
    const sdkLoaded = (window as any)[sdkInitKey];
    
    // 检查 SDK 脚本是否已经存在于页面中
    const existingScripts = document.querySelectorAll('script[src*="h5_sdk/i.js"]');
    const scriptExists = existingScripts.length > 0;
    console.log('SDK 脚本是否已存在:', scriptExists, '数量:', existingScripts.length);
    
    if (!sdkLoaded) {
      console.log('开始加载章节页腾讯广告 SDK...');
      console.log('push 时的队列状态:', {
        queueLength: Array.isArray(gdt) ? gdt.length : 0,
        queueContent: Array.isArray(gdt) ? gdt.map((item: any) => ({
          placement_id: item?.placement_id,
          hasOnComplete: typeof item?.onComplete === 'function'
        })) : 'not array'
      });
      
      // 检查容器是否存在（SDK 可能需要容器存在才能处理队列）
      const container = document.getElementById(containerId);
      console.log('容器是否存在（SDK 加载前）:', !!container, '容器ID:', containerId);
      if (!container) {
        console.log('⚠️ 容器不存在，但继续加载 SDK（SDK 应该能在 onComplete 时处理）');
      }
      
      // 如果脚本已存在，移除旧脚本后重新加载
      if (scriptExists) {
        console.log('⚠️ 检测到 SDK 脚本已存在，移除旧脚本');
        existingScripts.forEach(script => {
          script.remove();
          console.log('已移除 SDK 脚本');
        });
      }
      
      // 在加载 SDK 前，再次确认 TencentGDT 数组状态
      const gdtBeforeSDKLoad = (window as any).TencentGDT;
      console.log('=== SDK 加载前的 TencentGDT 状态检查 ===');
      console.log('TencentGDT:', gdtBeforeSDKLoad);
      console.log('isArray:', Array.isArray(gdtBeforeSDKLoad));
      console.log('queueLength:', Array.isArray(gdtBeforeSDKLoad) ? gdtBeforeSDKLoad.length : 0);
      if (Array.isArray(gdtBeforeSDKLoad) && gdtBeforeSDKLoad.length > 0) {
        console.log('队列内容（SDK 加载前）:', gdtBeforeSDKLoad.map((item: any, index: number) => ({
          index,
          placement_id: item?.placement_id,
          app_id: item?.app_id,
          type: item?.type,
          hasOnComplete: typeof item?.onComplete === 'function',
          hasOnError: typeof item?.onError === 'function'
        })));
      }
      
      (function() {
        var doc = document,
        h = doc.getElementsByTagName('head')[0],
        s = doc.createElement('script');
        // 注意：根据官方文档，SDK 应该在 push 之后加载
        // 使用 async = false 同步加载，确保 SDK 在页面渲染前完全加载
        // SDK 会在加载时读取 TencentGDT 数组中的配置
        s.async = false; // 同步加载，确保SDK在页面渲染前完全加载
        s.src = 'https://qzs.gdtimg.com/union/res/union_sdk/page/h5_sdk/i.js';
        s.onerror = function() {
          console.error('❌ 章节页腾讯广告 SDK 加载失败');
        };
        s.onload = function() {
          console.log('✅ 章节页腾讯广告 SDK 脚本加载完成');
          // 标记章节页SDK已加载（章节页独立标记）
          (window as any)[sdkInitKey] = true;
        };
        h && h.insertBefore(s, h.firstChild);
      })();
    } else {
      console.log('章节页腾讯广告 SDK 已加载，跳过');
      console.log('⚠️ SDK 已加载，但 push 可能无效（SDK 只处理加载时的队列）');
      console.log('⚠️ 如果 onComplete 没有被调用，说明 push 无效');
    }
  }, []);

  // 加载下一章
  const loadNextChapter = useCallback(async (nextCcid: string) => {
    if (!nextCcid || loadingNextRef.current) return;
    
    try {
      loadingNextRef.current = true;
      setLoadingNext(true);
      const chapterContentData = await getChapterContent({
        cbid: bookId,
        ccid: nextCcid
      });
      
      // 更新章节数据
      const newChapter = {
        id: chapterContentData.ccid,
        ccid: chapterContentData.ccid,
        title: chapterContentData.chapterTitle || '',
        content: chapterContentData.content || '',
        nextCcid: chapterContentData.nextCcid
      };
      
      // 保存当前滚动位置和上一章节ID
      const currentScrollTop = contentRef.current?.scrollTop || 0;
      const previousChapterId = chapter?.ccid || null;
      
      // 清除之前的定时器
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      // 如果存在上一章节，更新上一章节的进度为 100%
      if (previousChapterId) {
        try {
          const userId = getUserId();
          const bookmarksKey = `bookmarks_${userId}_${bookId}`;
          const existingBookmarks = localStorage.getItem(bookmarksKey);
          
          if (existingBookmarks) {
            const bookmarks = JSON.parse(existingBookmarks);
            const previousChapterIndex = bookmarks.findIndex((b: { chapterId: string }) => b.chapterId === previousChapterId);
            
            if (previousChapterIndex >= 0) {
              // 更新上一章节的进度为 100%
              bookmarks[previousChapterIndex] = {
                ...bookmarks[previousChapterIndex],
                progress: 100,
                timestamp: Date.now()
              };
              localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
            }
          }
        } catch (error) {
          console.error('更新上一章节进度失败:', error);
        }
      }
      
      // 更新当前章节（用于书签等功能）
      setChapter(newChapter);
      previousChapterIdRef.current = previousChapterId;
      
      // 将新章节追加到所有章节列表中
      setAllChapters(prev => {
        const updatedChapters = [...prev, {
          id: newChapter.ccid,
          ccid: newChapter.ccid,
          title: newChapter.title,
          content: newChapter.content,
          chapterOrder: chapterContentData.chapterOrder || 0
        }];
        
        // 加载新章节的广告（延迟执行，确保DOM已渲染）
        setTimeout(() => {
          const chapterIndex = updatedChapters.length - 1;
          if (chapterIndex > 0) {
            const adContainerId = `adContainer_chapter_${newChapter.ccid}_${chapterIndex}`;
            initChapterAd(adContainerId);
          }
        }, 100);
        
        return updatedChapters;
      });
      
      // 更新 ref 和 state
      nextCcidRef.current = chapterContentData.nextCcid;
      setHasNextChapter(!!chapterContentData.nextCcid);
      
      // 记录加载时间
      lastLoadTimeRef.current = Date.now();
      
      // 等待内容渲染完成，然后恢复滚动位置（不滚动到顶部）
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 恢复之前的滚动位置，让用户继续阅读
      if (contentRef.current) {
        contentRef.current.scrollTop = currentScrollTop;
      }
      
      // 自动存储书签和当前阅读位置（翻到下一章时，当前章节 progress 为 0）
      try {
        const userId = getUserId();
        const progress = 0; // 翻到下一章时，当前章节 progress 为 0
        
        // 存储当前阅读位置
        const currentReadingKey = `currentReading_${userId}_${bookId}`;
        localStorage.setItem(currentReadingKey, JSON.stringify({
          chapterId: newChapter.ccid,
          chapterTitle: newChapter.title,
          progress,
          timestamp: Date.now()
        }));
        
        // 自动添加到书签列表
        const bookmarksKey = `bookmarks_${userId}_${bookId}`;
        const existingBookmarks = localStorage.getItem(bookmarksKey);
        let bookmarks: Array<{
          bookId: string;
          chapterId: string;
          chapterTitle: string;
          progress: number;
          timestamp: number;
        }> = [];
        
        if (existingBookmarks) {
          bookmarks = JSON.parse(existingBookmarks);
        }
        
        // 检查是否已存在该章节的书签，如果存在则更新，否则添加
        const bookmark = {
          bookId,
          chapterId: newChapter.ccid,
          chapterTitle: newChapter.title,
          progress,
          timestamp: Date.now()
        };
        
        const existingIndex = bookmarks.findIndex(b => b.chapterId === newChapter.ccid);
        if (existingIndex >= 0) {
          bookmarks[existingIndex] = bookmark;
        } else {
          bookmarks.push(bookmark);
        }
        
        // 保存书签列表
        localStorage.setItem(bookmarksKey, JSON.stringify(bookmarks));
        
        // 启动 30 秒定时器，更新当前章节的 progress
        progressTimerRef.current = setTimeout(() => {
          try {
            const currentProgress = calculateProgress();
            const currentChapterId = newChapter.ccid;
            
            // 检查是否还在当前章节（防止已经翻到下一章了）
            const currentReading = localStorage.getItem(currentReadingKey);
            if (currentReading) {
              const reading = JSON.parse(currentReading);
              if (reading.chapterId === currentChapterId) {
                // 更新当前阅读位置
                localStorage.setItem(currentReadingKey, JSON.stringify({
                  chapterId: currentChapterId,
                  chapterTitle: newChapter.title,
                  progress: currentProgress,
                  timestamp: Date.now()
                }));
                
                // 更新书签列表中的进度
                const updatedBookmarks = localStorage.getItem(bookmarksKey);
                if (updatedBookmarks) {
                  const bookmarkList = JSON.parse(updatedBookmarks);
                  const bookmarkIndex = bookmarkList.findIndex((b: { chapterId: string }) => b.chapterId === currentChapterId);
                  if (bookmarkIndex >= 0) {
                    bookmarkList[bookmarkIndex] = {
                      ...bookmarkList[bookmarkIndex],
                      progress: currentProgress,
                      timestamp: Date.now()
                    };
                    localStorage.setItem(bookmarksKey, JSON.stringify(bookmarkList));
                  }
                }
              }
            }
          } catch (error) {
            console.error('30秒后更新进度失败:', error);
          }
        }, 30000); // 30秒
      } catch (error) {
        console.error('更新阅读记录失败:', error);
      }
    } catch (err) {
      console.error('加载下一章失败:', err);
    } finally {
      loadingNextRef.current = false;
      setLoadingNext(false);
    }
  }, [bookId, updateBookmark]);

  // 监听滚动事件，检测是否滚动到底部（往上滑动到底部时触发）
  useEffect(() => {
    if (!contentRef.current || !chapter) {
      return;
    }

    let scrollTimeout: NodeJS.Timeout | null = null;
    let scrollCount = 0;

    const handleScroll = () => {
      scrollCount++;
      const content = contentRef.current;
      if (!content) {
        return;
      }

      if (loadingNextRef.current) {
        return;
      }

      // 检查距离上次加载的时间，如果小于1秒，不触发（防止加载完成后立即触发）
      const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current;
      if (timeSinceLastLoad < 1000) {
        return;
      }

      // 清除之前的定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // 使用防抖，避免频繁触发
      scrollTimeout = setTimeout(() => {
        const scrollTop = content.scrollTop;
        const scrollHeight = content.scrollHeight;
        const clientHeight = content.clientHeight;
        
        // 计算距离底部的距离
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        
        // 获取最新的下一章ID
        const currentNextCcid = nextCcidRef.current;
        
        // 检查内容高度是否大于容器高度
        const hasScrollableContent = scrollHeight > clientHeight;
        
        // 判断是否到底部
        const isAtBottom = (hasScrollableContent && distanceToBottom <= 100) || 
                          (hasScrollableContent && distanceToBottom === 0 && scrollTop > 0) ||
                          (!hasScrollableContent && distanceToBottom === 0 && timeSinceLastLoad >= 1000);
        
        if (isAtBottom && currentNextCcid && !loadingNextRef.current && timeSinceLastLoad >= 1000) {
          loadNextChapter(currentNextCcid);
        }
      }, 200); // 200ms 防抖
    };

    const contentElement = contentRef.current;
    
    // 验证元素是否可以滚动，如果不可滚动且满足条件，自动触发加载
    if (contentElement) {
      // 延迟检查，确保内容已渲染
      setTimeout(() => {
        const scrollHeight = contentElement.scrollHeight;
        const clientHeight = contentElement.clientHeight;
        const canScroll = scrollHeight > clientHeight;
        const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current;
        
        // 如果内容不可滚动，且距离上次加载超过1秒，且有下一章，则自动触发加载
        if (!canScroll && nextCcidRef.current && !loadingNextRef.current && timeSinceLastLoad >= 1000) {
          loadNextChapter(nextCcidRef.current);
        }
      }, 500);
    }
    
    contentElement.addEventListener('scroll', handleScroll, { passive: true });
    
    // 如果内容不可滚动，监听触摸事件来判断是否到底部
    let touchStartY = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;
      const touchDuration = Date.now() - touchStartTime;
      
      if (!contentElement) return;
      
      const scrollHeight = contentElement.scrollHeight;
      const clientHeight = contentElement.clientHeight;
      const scrollTop = contentElement.scrollTop;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const canScroll = scrollHeight > clientHeight;
      const timeSinceLastLoad = Date.now() - lastLoadTimeRef.current;
      
      // 如果内容不可滚动，任何向上滑动（即使很小）都应该触发加载
      if (!canScroll && deltaY > 0 && nextCcidRef.current && !loadingNextRef.current && timeSinceLastLoad >= 1000) {
        loadNextChapter(nextCcidRef.current);
        return;
      }
      
      // 如果内容可滚动，向上滑动（deltaY > 0）且滑动距离大于20px，且滑动时间小于800ms
      if (canScroll && deltaY > 20 && touchDuration < 800) {
        // 如果已经到底部，触发加载
        if (distanceToBottom <= 50 && nextCcidRef.current && !loadingNextRef.current && timeSinceLastLoad >= 1000) {
          loadNextChapter(nextCcidRef.current);
        }
      }
    };
    
    contentElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    contentElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      contentElement.removeEventListener('scroll', handleScroll);
      contentElement.removeEventListener('touchstart', handleTouchStart);
      contentElement.removeEventListener('touchend', handleTouchEnd);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [chapter?.ccid, loadNextChapter]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  // 保存书签到本地存储
  const saveBookmark = () => {
    if (!chapter) return;
    try {
      const userId = getUserId();
      // 标记用户已经手动点击过"加入书签收藏"
      const bookmarkClickedKey = `bookmark_clicked_${userId}_${bookId}`;
      localStorage.setItem(bookmarkClickedKey, 'true');
      
      // 隐藏书签栏
      setShowBookmarkBar(false);
      // 显示提示
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 2000);
    } catch (error) {
      console.error('保存书签失败:', error);
    }
  };

  if (loading) {
    return (
      <main className={common.pageBase2}>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          加载中...
        </div>
      </main>
    );
  }

  if (error || !chapter) {
    return (
      <main className={common.pageBase2}>
        <div style={{ padding: '20px', textAlign: 'center', color: '#f06e2b' }}>
          {error || '章节不存在'}
        </div>
      </main>
    );
  }

  return (
    <main className={common.pageBase2}>
      <header className={styles.header}>
        <a className={common.backButtonBase} href={getStaticLink(`/book?id=${bookId}`)} style={{ textDecoration: 'none', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fh@2x.png"
            alt="返回"
            width={32}
            height={32}
            className={common.backIconBase}
          />
        </a>
        {bookTitle && (
          <div className={styles.bookTitle}>
            {bookTitle}
          </div>
        )}
        <a className={styles.catalogButton} href={getStaticLink(`/book/catalog?id=${bookId}`)} style={{ textDecoration: 'none' }}>
          目录
        </a>
      </header>

      <div 
        ref={contentRef}
        className={styles.content}
      >
        
        {allChapters.map((chapterItem, chapterIndex) => {
          const adContainerId = `adContainer_chapter_${chapterItem.ccid}_${chapterIndex}`;
          return (
            <div key={chapterItem.ccid}>
              {/* 从第二个章节开始，在标题上方显示广告 */}
              {chapterIndex > 0 && (
                <div id={adContainerId} style={{ margin: '20px 0', minHeight: '10px' }}></div>
              )}
              <h1 className={styles.chapterTitle}>{chapterItem.title}</h1>
              <div className={styles.textContent}>
                  <div className={styles.chapterSection}>
                    {chapterItem.content.split('\r\n').map((paragraph, index) => (
                      paragraph.trim() && (
                        <p key={`${chapterItem.ccid}-${index}`} className={styles.paragraph}>
                          {paragraph.trim()}
                        </p>
                      )
                    ))}
                  </div>
              </div>
            </div>
          );
        })}
       
        
        {loadingNext && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            加载下一章中...
          </div>
        )}
        {!loadingNext && !hasNextChapter && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
            已到最后一章
          </div>
        )}
      </div>

      {showBookmarkBar && (
        <div 
          className={`${styles.bookmarkBar} ${source === 'source2' ? styles.bookmarkBarBubble : ''}`}
        >
          <div className={styles.bookmarkTextContainer}>
            <div className={styles.bookmarkText}>喜欢本书，加入书签收藏</div>
            <div className={styles.bookmarkSubText}>加入后可以从浏览器书签找到这本书~</div>
          </div>
          {source === 'source2' ? (
            <button 
              className={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const userId = getUserId();
                  // 标记用户已经关闭过书签栏，此书不再显示
                  const bookmarkClosedKey = `bookmark_closed_${userId}_${bookId}`;
                  localStorage.setItem(bookmarkClosedKey, 'true');
                  setShowBookmarkBar(false);
                } catch (error) {
                  console.error('保存关闭状态失败:', error);
                  setShowBookmarkBar(false);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/close@2x.png"
                alt="关闭"
                width={20}
                height={20}
                className={styles.closeIcon}
              />
            </button>
          ) : (
            <button 
              className={styles.addBookmarkButton}
              onClick={saveBookmark}
            >
              加入书签
            </button>
          )}
        </div>
      )}

      {showToast && (
        <div className={styles.toast}>
          <span className={styles.toastText}>已加入书签收藏</span>
          <span className={styles.toastSubText}>下次你可以从浏览器书签找到这本书</span>
        </div>
      )}
    </main>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReadContent />
    </Suspense>
  );
}

