'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getBookInfo, BookInfo, getUserId } from '../../lib/api';
import common from '../styles/common.module.css';
import styles from './page.module.css';

function BookDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('id') as string;
  const [book, setBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSlidingUp, setIsSlidingUp] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // 处理上滑开始阅读的逻辑
  const handleStartReading = () => {
    if (isSlidingUp) return; // 防止重复触发
    setIsSlidingUp(true);
    
    setTimeout(() => {
      try {
        const userId = getUserId();
        const bookmarksKey = `bookmarks_${userId}_${bookId}`;
        let targetChapterId: string | null = null;

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
              targetChapterId = latestBookmark.chapterId;
            }
          }
        }
        // 如果有记录，跳转到记录的位置；否则跳转到第一页
        if (targetChapterId) {
          window.location.href = `/book/read?id=${bookId}&chapter=${targetChapterId}`;
        } else {
          window.location.href = `/book/read?id=${bookId}`;
        }
      } catch (error) {
        console.error('检查阅读记录失败:', error);
        // 出错时跳转到第一页
        window.location.href = `/book/read?id=${bookId}`;
      }
    }, 500);
  };

  // 调用书籍详情接口
  useEffect(() => {
    const fetchBookInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBookInfo(bookId);
        setBook(data);
      } catch (err) {
        console.error('获取书籍详情失败:', err);
        setError(err instanceof Error ? err.message : '获取书籍详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      fetchBookInfo();
    }
  }, [bookId]);

  // 动态设置页面标题
  useEffect(() => {
    if (book && book.title) {
      document.title = `<<${book.title}>>-微米小说`;
    } else {
      document.title = '微米小说';
    }

    // 组件卸载时恢复默认标题
    return () => {
      document.title = '微米小说';
    };
  }, [book]);


  // 监听上滑手势
  useEffect(() => {
    if (!mainRef.current || !book) return;

    let touchStartY = 0;
    let touchEndY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY; // 向上滑动时 deltaY > 0
      const touchDuration = Date.now() - touchStartTime;

      // 检测向上滑动：滑动距离大于50px，且滑动时间小于500ms（快速滑动）
      if (deltaY > 50 && touchDuration < 500 && !isSlidingUp) {
        handleStartReading();
      }
    };

    const mainElement = mainRef.current;
    mainElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    mainElement.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      mainElement.removeEventListener('touchstart', handleTouchStart);
      mainElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [book, isSlidingUp, bookId, router]);

  if (loading) {
    return (
      <main className={common.pageBase2}>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          加载中...
        </div>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className={common.pageBase2}>
        <div style={{ padding: '20px', textAlign: 'center', color: '#f06e2b' }}>
          {error || '书籍不存在'}
        </div>
      </main>
    );
  }

  return (
    <main 
      ref={mainRef}
      className={`${common.pageBase2} ${isSlidingUp ? styles.pageSlideUp : ''}`} 
      style={{ transition: 'transform 0.5s ease-out' }}
    >
      <div className={styles.container}>
        <header className={`${styles.header} ${styles.stickyHeader}`}>
          
          <button className={common.backButtonBase} onClick={() => router.push('/')}>
            <Image
              src="/fh@2x.png"
              alt="返回"
              width={32}
              height={32}
              className={common.backIconBase}
              priority
              unoptimized
            />
          </button>
          <button className={styles.catalogButton} onClick={() => router.push(`/book/catalog?id=${book.id}`)}>
            目录
          </button>
        </header>

        <div className={styles.scrollArea}>
          <div className={styles.bookCoverSection}>
        <div className={styles.coverWrapper}>
          <Image
            src={book.coverUrl}
            alt={book.title}
            width={128}
            height={176}
            className={styles.bookCover}
            priority
            unoptimized
            onError={(e) => {
              // 图片加载失败时使用默认图片
              (e.target as HTMLImageElement).src = '/2.png';
            }}
          />
        </div>
      </div>

      <div className={styles.bookInfo}>
        <div className={styles.source}>{book.site}</div>
        <h1 className={styles.bookTitle}>{book.title}</h1>
        <div className={styles.author}>作者: {book.authorName}</div>
      </div>

      <section className={styles.synopsis}>
        <div className={styles.synopsisWrapper}>
          <span className={styles.synopsisTitle}>简介：</span>
          <span className={styles.desc}>
            {book.intro}
          </span>
          
        </div>
      </section>
          
      <div className={styles.readButtonWrapper}>
        <button 
          className={styles.readButton} 
          onClick={handleStartReading}
        >
         
          <Image
            src="/sh@2x.png"
            alt="上滑"
            width={22}
            height={21}
            className={styles.upIcon}
            unoptimized
          />
          <span className={styles.readButtonText}>上滑开始阅读</span>
        </button>
        </div>
        </div>
      </div>
    </main>
  );
}

export default function BookDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookDetailContent />
    </Suspense>
  );
}

