var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'TruyenTranh.net',
  website: 'http://truyentranh.net',

  match: function(link, options) {
    return /truyentranh\.net/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranh.net');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.each-page').length) {
      var chapter_title = $('.chapter-title').eq(0).text().trim();
      
      var chapter_images = saver.getImages($, page, '.each-page');
      if (options.debug) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);

    } else if ($('.total-chapter').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('h1.title-manga').first().text().trim();
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
      
      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '#examples .content');
      chapter_links.sort(function(a, b){
        if(a.toLowerCase() < b.toLowerCase()) return -1;
        if(a.toLowerCase() > b.toLowerCase()) return 1;
        return 0;
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.total-chapter').length) {
      manga_info.url = page.url;
      manga_info.name = $('.manga-detail .title-manga').first().text();
      manga_info.cover_image = $('.manga-detail .cover-detail img').attr('src');
      manga_info.description = $('.manga-content').text().trim();

      var addAuthor = function(genre) {
        if (!manga_info.authors) manga_info.authors = [];
        manga_info.authors.push(genre);
      }
      var addGenre = function(genre) {
        if (!manga_info.genres) manga_info.genres = [];
        manga_info.genres.push(genre);
      }

      $('.description-update a').each(function() {
        var href = $(this).attr('href');
        var text = $(this).text().trim();
        if (href.indexOf('/the-loai/') >= 0) {
          addGenre(text);
        } else if (href.indexOf('/tac-gia/') >= 0) {
          addAuthor(text); 
        } else if (href.indexOf('/trang-thai/') >= 0) {
          manga_info.status = text;
        }
      });

      var manga_chapters = [];
      $('#examples .content').find('a').each(function() {
        var chapter_published_date = $(this).find('span.date-release').text();
        chapter_published_date = utils.replaceAll(chapter_published_date,'\n','');
        manga_chapters.push({
          url: $(this).attr('href'),
          title: $(this).attr('title').trim(),
          published_date_str: chapter_published_date
        });
      });
      
      manga_info.chapter_count = manga_chapters.length;
      
      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }
      
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
