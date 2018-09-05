var path = require('path');

module.exports = {
  
  name: 'Uptruyen',
  website: 'http://uptruyen.com',

  match: function(link, options) {
    return /uptruyen\.com\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Uptruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#reader-box').length) {
      var chapter_title = page.title.split('|')[0].trim();
      if (options.uptruyen_chapters_map[page.url]) {
        chapter_title = options.uptruyen_chapters_map[page.url].title;
      }

      var chapter_images = saver.getImages($, page, '#reader-box', {
        blacklist: ['.gif']
      });
      if (options.debug) console.log(chapter_images);

      chapter_images.forEach(function(chapter_image) {
        if (chapter_image.file && path.extname(chapter_image.file).indexOf('_imgmax=') != -1) {
          chapter_image.file = chapter_image.file.slice(0, chapter_image.file.indexOf('_imgmax='));
        } else if (!chapter_image.file && path.extname(path.basename(chapter_image.src)).indexOf('_imgmax=') != -1) {
          var image_file = path.basename(chapter_image.src);
          chapter_image.file = image_file.slice(0, image_file.indexOf('_imgmax='));
        }
      });

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir.replace('.html','')
      }, options, callback);

    } else if ($('.detail-page').length && $('#chapter_table').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.breadcrumb a').last().text().trim();
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }
      
      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = this.getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }
      
      var chapter_links = saver.getLinks($, page, '#chapter_table', {
        exclude_visited_links: true
      });

      options.uptruyen_chapters_map = {};
      $('#chapter_table .row').each(function() {
        var chapter_url = $(this).find('.detail-chap-name a').attr('href');
        var chapter_title = $(this).find('.detail-chap-name a').text();

        options.uptruyen_chapters_map[chapter_url] = {
          title: chapter_title
        };

        var downloaded_chapter = saver.getStateData(chapter_url);
        if (downloaded_chapter && chapter_title) {
          if (downloaded_chapter.chapter_title != chapter_title) {
            saver.updateStateData(chapter_url, {
              chapter_title: chapter_title
            });
          }
        }
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.detail-page').length && $('#chapter_table').length) {
      manga_info.url = page.url;
      manga_info.name = $('.breadcrumb a').last().text().trim();
      manga_info.cover_image = $('.detail-image-primary a img').attr('src');
      if (manga_info.cover_image && manga_info.cover_image.indexOf('/') == 0) {
        if (manga_info.cover_image.indexOf('//') == -1) {
          manga_info.cover_image = 'http://uptruyen.com' + manga_info.cover_image;
        }
      }
      manga_info.description = $('.description-story').text().replace('\r\n','').trim();

      $('.detail-info-story p').each(function() {
        var info_text = $(this).text();
        if (!info_text) return;
        info_text = info_text.trim();

        if (info_text.indexOf('Tình trạng:') == 0) {
          manga_info.status = $(this).find('a').text().trim();
        } else if (info_text.indexOf('Tác giả:') == 0) {
          manga_info.authors = [];
          $(this).find('a').each(function() {
            var author_name = $(this).text();
            if (author_name && manga_info.authors.indexOf(author_name) == -1) {
              manga_info.authors.push(author_name);
            }
          });
        } else if (info_text.indexOf('Thể loại:') == 0) {
          manga_info.genres = [];
          $(this).find('a').each(function() {
            var genre_name = $(this).text();
            if (genre_name && manga_info.genres.indexOf(genre_name) == -1) {
              manga_info.genres.push(genre_name);
            }
          });
        } else if (info_text.indexOf('Tên khác:') == 0) {
          manga_info.alt_names = [];
          $(this).find('a').each(function() {
            var alt_name = $(this).text();
            if (alt_name && manga_info.alt_names.indexOf(alt_name) == -1) {
              manga_info.alt_names.push(alt_name);
            }
          });
        }
      });

      var manga_chapters = [];
      $('#chapter_table .row').each(function() {
        manga_chapters.push({
          url: $(this).find('.detail-chap-name a').attr('href'),
          title: $(this).find('.detail-chap-name a').text(),
          published_date_str: $(this).find('.detail-chap-create').text()
        });
      });

      manga_info.chapter_count = manga_chapters.length;
      
      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        console.log('    Authors: ' + manga_info.authors);
        console.log('    Genres: ' + manga_info.genres);
        console.log('    Status: ' + manga_info.status);
        console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}