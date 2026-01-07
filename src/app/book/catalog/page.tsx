'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getChapterList, getUserId, ChapterListItem } from '../../../lib/api';
import common from '../../styles/common.module.css';
import styles from './page.module.css';

interface Chapter {
  ccid: string;
  chapterTitle: string;
  actualWords: number;
  progress: number;
  volumeName?: string;
  chapterOrder: number;
}

function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('id') as string;
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // desc: 倒序, asc: 正序
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0); // 保存总页数
  const contentRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const pageNumRef = useRef(1); // 使用 ref 存储最新的页码，避免闭包问题
  const totalPagesRef = useRef(0); // 使用 ref 存储总页数，避免闭包问题
  const totalCountRef = useRef(0); // 使用 ref 存储总数量，避免闭包问题
  const hasMoreRef = useRef(true); // 使用 ref 存储 hasMore，避免闭包问题
  const sortOrderRef = useRef<'asc' | 'desc'>('asc'); // 使用 ref 存储排序顺序，避免闭包问题
  const autoLoadCountRef = useRef(0); // 记录连续自动加载的次数
  const lastCheckTimeRef = useRef(0); // 记录上次检查的时间，防止频繁检查

  // 从 localStorage 获取阅读进度
  const getChapterProgress = (ccid: string): number => {
    try {
      const userId = getUserId();
      const currentReadingKey = `currentReading_${userId}_${bookId}`;
      const currentReading = localStorage.getItem(currentReadingKey);
      
      if (currentReading) {
        const reading = JSON.parse(currentReading);
        if (reading.chapterId === ccid) {
          return reading.progress || 0;
        }
      }
      
      // 也检查书签列表
      const bookmarksKey = `bookmarks_${userId}_${bookId}`;
      const bookmarks = localStorage.getItem(bookmarksKey);
      if (bookmarks) {
        const bookmarkList = JSON.parse(bookmarks);
        const bookmark = bookmarkList.find((b: { chapterId: string }) => b.chapterId === ccid);
        if (bookmark) {
          return bookmark.progress || 0;
        }
      }
    } catch (error) {
      console.error('获取阅读进度失败:', error);
    }
    return 0;
  };

  const defaultPageSize = 100; // 默认每页加载100条

  // 加载章节列表
  const loadChapters = useCallback(async (page: number, isInitial: boolean = false, pageSize?: number) => {
    if (loadingMoreRef.current) return;
    
    // 如果没有传入 pageSize，使用默认值
    const currentPageSize = pageSize ?? defaultPageSize;
    
    // 使用 ref 获取最新的排序顺序，避免闭包问题
    const currentSortOrder = sortOrderRef.current;
    
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      loadingMoreRef.current = true;
      
      const chapterListData = await getChapterList({
        cbid: bookId,
        pageNum: page,
        pageSize: currentPageSize
      });
      
      if (chapterListData.resultData && chapterListData.resultData.length > 0) {
        // 转换数据格式
        const formattedChapters: Chapter[] = chapterListData.resultData.map((item) => ({
          ccid: item.ccid,
          chapterTitle: item.chapterTitle || '',
          actualWords: item.actualWords || item.originalWords || 0,
          progress: getChapterProgress(item.ccid),
          volumeName: item.volumeName || undefined,
          chapterOrder: item.chapterOrder || 0
        }));
        
        // 追加到现有列表，并去重（根据 ccid）
        // 使用函数式更新，确保使用最新的 chapters 状态
        setChapters(prevChapters => {
          const existingCids = new Set(prevChapters.map(ch => ch.ccid));
          const newChapters = formattedChapters.filter(ch => !existingCids.has(ch.ccid));
          const updatedChapters = [...prevChapters, ...newChapters];
          
         
          
          return updatedChapters;
        });
        setTotalCount(chapterListData.totalCount);
        totalCountRef.current = chapterListData.totalCount; // 同步更新 ref
        
        // 保存总页数（使用接口返回的 pages 字段）
        const currentTotalPages = chapterListData.pages || Math.ceil(chapterListData.totalCount / currentPageSize);
        if (chapterListData.pages && chapterListData.pages > 0) {
          setTotalPages(chapterListData.pages);
          totalPagesRef.current = chapterListData.pages;
        } else {
          // 如果没有返回 pages，则计算
          setTotalPages(currentTotalPages);
          totalPagesRef.current = currentTotalPages;
        }
        
        // 判断是否还有更多数据
        // 正序：已加载数量 < 总数量 或 page < totalPages，加载后 pageNum = page + 1
        // 倒序：page > 1，加载后 pageNum = page - 1
        if (currentSortOrder === 'desc') {
          // 倒序：当前加载的是 page，下次应该加载 page - 1
          const hasMoreData = page > 1;
          setHasMore(hasMoreData);
          hasMoreRef.current = hasMoreData; // 同时更新 ref
          const nextPageToLoad = page > 1 ? page - 1 : 1;
          setPageNum(nextPageToLoad);
          pageNumRef.current = nextPageToLoad; // 同时更新 ref
        } else {
          // 正序：当前加载的是 page，下次应该加载 page + 1
          // 使用函数式更新获取最新的章节数量来判断是否还有更多
          setChapters(prevChapters => {
            // 使用接口返回的最新 totalCount，而不是闭包中的旧值
            // 注意：这里使用 updatedChapters 的长度，因为 prevChapters 还没有包含新加载的数据
            const updatedChapters = [...prevChapters, ...formattedChapters.filter(ch => {
              const existingCids = new Set(prevChapters.map(c => c.ccid));
              return !existingCids.has(ch.ccid);
            })];
            const hasMoreData = updatedChapters.length < chapterListData.totalCount || page < currentTotalPages;
            setHasMore(hasMoreData);
            hasMoreRef.current = hasMoreData; // 同时更新 ref
            const nextPageToLoad = page + 1;
            setPageNum(nextPageToLoad);
            pageNumRef.current = nextPageToLoad; // 同时更新 ref
            return prevChapters; // 返回原值，因为已经在上面更新过了
          });
        }
      } else {
        // 接口返回空数据时，需要根据当前排序顺序判断是否还有更多数据
        if (currentSortOrder === 'desc') {
          // 倒序：如果当前 page > 1，说明还有前面的页可以加载
          const hasMoreData = page > 1;
          setHasMore(hasMoreData);
          hasMoreRef.current = hasMoreData;
          // 更新 pageNum 为 page - 1（如果 page > 1）
          const nextPageToLoad = page > 1 ? page - 1 : 1;
          setPageNum(nextPageToLoad);
          pageNumRef.current = nextPageToLoad;
        } else {
          // 正序：如果当前 page < totalPages，说明还有后面的页可以加载
          // 使用 ref 获取最新的总页数
          const currentTotalPages = totalPagesRef.current;
          const hasMoreData = page < currentTotalPages;
          setHasMore(hasMoreData);
          hasMoreRef.current = hasMoreData;
          // 更新 pageNum 为 page + 1（如果还有更多）
          const nextPageToLoad = hasMoreData ? page + 1 : page;
          setPageNum(nextPageToLoad);
          pageNumRef.current = nextPageToLoad;
        }
      }
    } catch (err) {
      console.error('获取章节列表失败:', err);
      setError(err instanceof Error ? err.message : '获取章节列表失败');
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
      loadingMoreRef.current = false;
    }
  }, [bookId, sortOrder]);

  // 初始加载（根据排序顺序决定从第几页开始）
  useEffect(() => {
    if (bookId) {
      if (sortOrder === 'desc') {
        // 倒序时，先加载第一页获取总页数
        loadChapters(1, true).then(() => {
          // 使用 ref 获取最新的总页数
          const pages = totalPagesRef.current;
          
          if (pages > 0) {
            setChapters([]); // 清空之前的数据
            const totalCount = totalCountRef.current;
            const newTotalCount = pages * defaultPageSize;
            const diffTotalCount = newTotalCount - totalCount;
            loadChapters(pages, true);
            // 注意：不需要在这里设置 pageNum，因为 loadChapters 内部会根据 sortOrder 自动设置
          }
        });
      } else {
        // 正序：从第一页开始
        loadChapters(1, true);
      }
    }
  }, [bookId, sortOrder, loadChapters]);

  // 监听滚动，加载更多
  useEffect(() => {
    if (!contentRef.current || loading) {
     
      return;
    }

    let scrollTimeout: NodeJS.Timeout | null = null;
    let scrollCount = 0;

    const handleScroll = () => {
      scrollCount++;
      const content = contentRef.current;
      if (!content || loadingMoreRef.current) return;

      // 清除之前的定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // 使用防抖，避免频繁触发
      scrollTimeout = setTimeout(() => {
        const scrollTop = content.scrollTop;
        const scrollHeight = content.scrollHeight;
        const clientHeight = content.clientHeight;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;

        // 使用 ref 获取最新的值，避免闭包问题
        const currentHasMore = hasMoreRef.current;
        const currentPageNum = pageNumRef.current;

        // 距离底部小于100px时加载下一页
        if (distanceToBottom < 100 && currentHasMore && !loadingMoreRef.current) {
          // 使用 ref 获取最新的排序顺序，确保倒序模式下使用正确的 pageNum
          const currentSortOrder = sortOrderRef.current;
          //console.log('✅ 滚动到底部，触发加载下一页，pageNum:', currentPageNum, 'sortOrder:', currentSortOrder, 'distanceToBottom:', Math.round(distanceToBottom));
          loadChapters(currentPageNum, false);
        }
      }, 200); // 200ms 防抖
    };

    const contentElement = contentRef.current;
   // console.log('设置滚动监听器，元素:', contentElement, 'hasMore:', hasMore, 'pageNum:', pageNumRef.current);
    
    // 只在初始加载后检查一次，如果不可滚动则自动加载一次
    // 之后完全依赖滚动事件来加载更多
    const checkInitialLoad = () => {
      if (!contentElement) return;
      
      setTimeout(() => {
        const scrollHeight = contentElement.scrollHeight;
        const clientHeight = contentElement.clientHeight;
        const canScroll = scrollHeight > clientHeight;
        const currentHasMore = hasMoreRef.current; // 使用 ref 获取最新的值
        const currentPageNum = pageNumRef.current;
        
        
        
        // 只在初始时，如果内容不可滚动且还有更多数据，自动加载一次
        if (!canScroll && currentHasMore && !loadingMoreRef.current && autoLoadCountRef.current === 0) {
          autoLoadCountRef.current = 1;
          //console.log('⚠️ 初始内容不可滚动，自动加载一次，pageNum:', currentPageNum);
          loadChapters(currentPageNum, false);
        }
      }, 800);
    };
    
    // 只在初始时检查一次
    checkInitialLoad();

    contentElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      contentElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [loading, hasMore, loadChapters]);

  const sortedChapters = [...chapters].sort((a, b) => {
    return sortOrder === 'desc' ? b.chapterOrder - a.chapterOrder : a.chapterOrder - b.chapterOrder;
  });

  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);
    sortOrderRef.current = newSortOrder; // 同时更新 ref
    
    // 切换排序时，清空现有数据，重新加载
    setChapters([]);
    setPageNum(1);
    pageNumRef.current = 1;
    setHasMore(true);
    hasMoreRef.current = true; // 同时更新 ref
    // 注意：不要重置 totalPages 和 totalCount，因为我们需要使用之前获取的值
    // 如果之前没有获取过，则通过加载第一页来获取
    autoLoadCountRef.current = 0;
    
    if (newSortOrder === 'desc') {
      // 倒序：从最后一页开始
      // 使用 ref 获取最新的总页数，避免闭包问题
      const currentTotalPages = totalPagesRef.current;
      if (currentTotalPages > 0) {
        // 直接加载最后一页
        loadChapters(currentTotalPages, true);
        // 注意：不需要在这里设置 pageNum，因为 loadChapters 内部会根据 sortOrder 自动设置
      } else {
        // 如果还没有总页数，先加载第一页获取总页数
        loadChapters(1, true).then(() => {
          // 使用 ref 获取最新的总页数
          const pages = totalPagesRef.current;
          if (pages > 0) {
            setChapters([]); // 清空之前的数据
            loadChapters(pages, true);
            // 注意：不需要在这里设置 pageNum，因为 loadChapters 内部会根据 sortOrder 自动设置
          }
        });
      }
    } else {
      // 正序：从第一页开始
      // 确保 hasMore 和 pageNum 正确重置
      setHasMore(true);
      hasMoreRef.current = true;
      setPageNum(1);
      pageNumRef.current = 1;
      loadChapters(1, true);
    }
  };

  return (
    <main className={common.pageBase2}>
      <header className={styles.header}>
        <button className={common.backButtonBase} onClick={() => router.push(`/book?id=${bookId}`)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fh@2x.png"
            alt="返回"
            width={32}
            height={32}
            className={common.backIconBase}
          />
        </button>
        <button className={styles.sortButton} onClick={toggleSortOrder}>
          <span className={styles.sortText}>
            {sortOrder === 'desc' ? '倒序' : '正序'} 
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sortOrder === 'desc' ? '/dx@2x.png' : '/zx@2x.png'}
            alt={sortOrder === 'desc' ? '倒序' : '正序'}
            width={18}
            height={18}
            className={styles.sortIcon}
          />
        </button>
      </header>
      <div className={styles.divider}></div>
      
      <div className={styles.content} ref={contentRef}>
        <div 
          className={styles.chapterList0}
          onClick={() => router.push(`/book?id=${bookId}`)}
        >
          书封页
        </div>
        <div className={styles.divider}></div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            加载中...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#f06e2b' }}>
            {error}
          </div>
        ) : sortedChapters.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            暂无章节数据
          </div>
        ) : (
          sortedChapters.map((chapter, index) => {
          const showVolume = chapter.volumeName && (
            index === 0 || sortedChapters[index - 1]?.volumeName !== chapter.volumeName
          );

          return (
            <div key={chapter.ccid}>
              {showVolume && (
                <>
                  <div className={styles.volumeTitle}>{chapter.volumeName}</div>
                  <div className={styles.divider}></div>
                </>
              )}
              
              <a 
                className={styles.chapterItem}
                href={`/book/read?id=${bookId}&chapter=${chapter.ccid}`}
              >
                {chapter.progress > 0 ? (
                  <div className={styles.chapterInfoRead}>
                    <div className={styles.chapterTitleRow}>
                      <span className={`${styles.chapterTitle} ${styles.chapterTitleRead}`}>
                        {chapter.chapterTitle}
                      </span>
                      <span className={styles.progress}>已读{chapter.progress}%</span>
                    </div>
                    <span className={styles.wordCount}>{chapter.actualWords}字</span>
                  </div>
                ) : (
                  <div className={styles.chapterInfo}>
                    <span className={styles.chapterTitle}>
                      {chapter.chapterTitle}
                    </span>
                    <div className={styles.chapterMeta}>
                      <span className={styles.wordCount}>{chapter.actualWords}字</span>
                    </div>
                  </div>
                )}
              </a>
              <div className={styles.divider}></div>
            </div>
          );
        }))}
        {loadingMore && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            加载更多章节中...
          </div>
        )}
        {chapters.length > 0 && (
          (sortOrder === 'desc' && pageNum <= 1) || 
          (sortOrder === 'asc' && !hasMore)
        ) && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
            已加载全部章节
          </div>
        )}
      </div>
    </main>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CatalogContent />
    </Suspense>
  );
}

