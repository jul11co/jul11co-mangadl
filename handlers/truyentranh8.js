var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'TruyenTranh8',
  website: 'http://truyentranh8.net',

  match: function(link, options) {
    return /truyentranh8\./g.test(link) || /truyentranhtam\./g.test(link) ;
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranh8');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.xemtruyen').length) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page:', page.url);
      
      page.title = $('title').first().text();
      if (page.title) {
        page.title = page.title.replace(/(\r\n|\n|\r)/gm, '');
      }

      var chapter_title = $('.TitleH2').text();
      if (options.debug) console.log('Chapter title:', chapter_title);

      var chapter_script = $.html('script');
      if (!chapter_script) {
        if (options.debug) console.log('No chapter script available');
        return callback();
      }
      // if (options.debug) console.log(chapter_script);

      var tmp_images = [];
      var tmp_arr = chapter_script.match(/lstImages\.push(.*?)(?=[;]|$)/g);
      if (tmp_arr) {
        for (var i = 0; i < tmp_arr.length; i++) {
          tmp_arr[i] = utils.replaceAll(tmp_arr[i], 'lstImages.push("', '');
          tmp_arr[i] = utils.replaceAll(tmp_arr[i], '")', '');
          tmp_images.push(tmp_arr[i]);
        }
      } else {
        var tmp_eval_code = /eval(\(.*\))/g.exec(chapter_script);
        if (tmp_eval_code) {
          var image_script = eval(tmp_eval_code[1]);
          eval(image_script);
          tmp_images = lstImages;
        }
      }
        
      if (tmp_images.length == 0) {
        if (options.debug) console.log('No chapter images.');
        return callback();
      }

      var image_file_names = [];
      var chapter_images = [];
      tmp_images.forEach(function(image_src) {
        var image_url = image_src;
        var image_url_obj = urlutil.parse(image_url);
        var image_file_name = path.basename(image_url_obj.pathname);
        image_file_name = saver.getUniqueFileName(image_file_names, image_file_name);
        chapter_images.push({
          src: image_url,
          file: image_file_name
        });
      });
      if (options.debug) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);

    } else if ($('#ChapList').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('h1.TitleH2').first().text().trim();
      manga_title = utils.replaceAll(manga_title, 'Truyện Tranh', '').trim();
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

      var chapter_links = saver.getLinks($, page, '#ChapList');
      
      chapter_links = chapter_links.filter(function(chapter_link) {
        if (chapter_link.indexOf('truyentranhtam.com') != -1) {
          return !saver.isDone(chapter_link.replace('truyentranhtam.com', 'truyentranh8.org')); 
        } else if (chapter_link.indexOf('truyentranh8.org') != -1) {
          return !saver.isDone(chapter_link.replace('truyentranh8.org', 'truyentranhtam.com')); 
        }
        return true;
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('#ChapList').length) {
      manga_info.url = page.url;
      manga_info.name = $('.TitleH2').first().text();
      if (manga_info.name) {
        manga_info.name = utils.replaceAll(manga_info.name, 'Truyện Tranh ', '').trim();
      }
      manga_info.cover_image = $('img.thumbnail').attr('src');
      manga_info.description = $('.mangaDescription').text();

      $('.mangainfo li').each(function() {
        if ($(this).children('b').length) {
          var info_key = $(this).children('b').text();
          var info_value = [];
          $(this).children().each(function() {
            var value = $(this).text();
            if (value !== info_key) {
              value = utils.replaceAll(value,'\n','');
              value = utils.replaceAll(value,';','');
              if (value != '') {
                info_value.push(value);
              }
            }
          });

          info_key = info_key.replace(': ','').replace(':','');
          if (info_key == 'Đánh giá' || info_key == 'Rate') {
            return;
          }
          if (info_key == 'Tên khác' || info_key == 'Alternate Name') {
            manga_info.alt_names = info_value;
          } else if (info_key == 'Tác giả' || info_key == 'Author') {
            manga_info.authors = info_value;
          } else if (info_key == 'Thể loại' || info_key == 'Genre') {
            manga_info.genres = info_value;
          } else if (info_key == 'Tình Trạng' || info_key == 'Status') {
            manga_info.status = info_value.join('').trim();
          } else {
            manga_info['extra'] = manga_info['extra'] || {};
            manga_info['extra'][info_key] = info_value;
          }
        }
      });

      var manga_chapters = [];
      $('ul#ChapList a[itemprop="itemListElement"]').each(function() {
        var chapter_published_date = $(this).find('time').attr('datetime');
        chapter_published_date = utils.replaceAll(chapter_published_date,'\n','');
        manga_chapters.push({
          url: $(this).attr('href'),
          title: $(this).find('h2').text(),
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
