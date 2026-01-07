'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getCategoryListBooks, CategoryListBook } from '../../lib/api';
import common from '../styles/common.module.css';
import styles from './page.module.css';

function CategoryListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryName = searchParams.get('category') || '玄幻';
  const freeTypeParam = searchParams.get('freeType');
  const freeType = freeTypeParam ? parseInt(freeTypeParam) : 1; // 默认1（男频）
  
  // 调试信息
  useEffect(() => {
    //console.log('接收到的参数 - category:', categoryName, 'freeType:', freeType, 'freeTypeParam:', freeTypeParam);
  }, [categoryName, freeType, freeTypeParam]);
  
  const [books, setBooks] = useState<CategoryListBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wordCountFilter, setWordCountFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');

  const wordCountOptions = ['全部', '少于30万字', '30-50万字', '50-100万字', '100-300万字'];
  const statusOptions = ['全部', '完结', '连载'];

  // 调用分类列表接口
  useEffect(() => {
    const fetchCategoryListBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCategoryListBooks({
          category: categoryName,
          freeType: freeType,
          pageNum: 1,
          pageSize: 20
        });
        setBooks(data.books);
      } catch (err) {
        console.error('获取分类列表数据失败:', err);
        setError(err instanceof Error ? err.message : '获取分类列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryListBooks();
  }, [categoryName, freeType]);

  return (
    <main className={common.pageBase}>
      <div className={common.bannerBgBase}></div>
      <div className={common.bannerBlurBase}></div>
      <div className={common.bannerBlur2Base}></div>

      <div className={styles.container}>
        <header className={`${common.headerWithBackBase} ${styles.stickyHeader}`}>
          <button className={common.backButtonBase} onClick={() => router.back()}>
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
        </header>
        
        <div className={styles.scrollArea}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>{categoryName}</h1>
          </div>
          
      {/* <section className={styles.filters}>
        <div className={styles.filterRow}>
          {wordCountOptions.map((option) => (
            <button
              key={option}
              onClick={() => setWordCountFilter(option)}
              className={`${styles.filterButton} ${
                wordCountFilter === option ? styles.filterActive : ''
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          {statusOptions.map((option) => (
            <button
              key={option}
              onClick={() => setStatusFilter(option)}
              className={`${styles.filterButton} ${
                statusFilter === option ? styles.filterActive : ''
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className={styles.placeholder}></div>
      </section> */}
      
          <section className={styles.bookList}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                加载中...
              </div>
            ) : error ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#f06e2b' }}>
                {error}
              </div>
            ) : books.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                暂无数据
              </div>
            ) : (
              books.map((book) => (
                <div 
                  key={book.id} 
                  className={styles.bookItem}
                  onClick={() => router.push(`/book?id=${book.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.bookCoverWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      width={80}
                      height={110}
                      className={styles.bookCover}
                      onError={(e) => {
                        // 图片加载失败时使用默认图片
                        (e.target as HTMLImageElement).src = '/1.png';
                      }}
                    />
                    <span className={styles.bookBadge}>{book.status}</span>
                  </div>
                  <div className={styles.bookInfo}>
                    <div className={styles.bookTitle}>{book.title}</div>
                    <div className={styles.bookMeta}>
                      <Image
                        src="/author@2x.png"
                        alt={book.authorName || ''}
                        width={13}
                        height={13}
                        className={styles.authorIcon}
                        unoptimized
                      />
                      <span className={styles.bookAuthor}>{book.authorName}</span>
                      <span className={styles.dot}></span>
                      <div className={styles.bookTagsContainer}>
                        {book.tags && book.tags.length > 0 ? (
                          book.tags.map((tag, index) => (
                            <span key={`${book.id}-${tag}-${index}`} className={styles.bookTag}>
                              {index > 0 && <span className={styles.tagDot}>·</span>}
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className={styles.bookTag}>{categoryName}</span>
                        )}
                      </div>
                    </div>
                    <p className={styles.bookDesc}>{book.intro}</p>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CategoryListPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CategoryListContent />
    </Suspense>
  );
}

