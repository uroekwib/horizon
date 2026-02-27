
        if ($('body').hasClass('index')) {
      const sliderEl = document.querySelector(".blaze-slider");

      const blazeSlider = new BlazeSlider(sliderEl, {
        all: {
          enableAutoplay: true,
          slidesToScroll: 8,
          slidesToShow: 8,
          transitionDuration: 300,
          loop: true
        },
           "(max-width: 1440px)": {
          slidesToShow: 6,
          slidesToShow: 6
        },
        "(max-width: 1150px)": {
          slidesToShow: 4,
          slidesToShow: 4,
          slidesGap: "40px"
        },
        "(max-width: 500px)": {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      });

      // listen for slide event
      blazeSlider.onSlide(
        (pageIndex, firstVisibleSlideIndex, lastVisibleSlideIndex) => {
          console.log({
            pageIndex,
            firstVisibleSlideIndex,
            lastVisibleSlideIndex
          });
        }
      );
        }


