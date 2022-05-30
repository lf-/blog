import contextlib


class Periods:
    y = 106
    x = {
        'en': 106,
        'fr': 106,
        'es': 146,
        'jp': 82,
    }


DEFS = """
"""

HEADER = """
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" height="17in" width="11in" onload="makeDraggable(evt)">
  <style>
    .text {
      font-family: "Source Han Sans";
      font-size: 14pt;
      font-weight: bolder;
      letter-spacing: -1.5px;
    }
    .text.japanese {
      font-size: 16pt;
      letter-spacing: -0.8px;
    }
    .wallside {
        transform: rotate(-45deg)translate(-13in, 1.2in);
    }
    .draggable, .draggable-group {
      cursor: move;
    }
  </style>
  <!--<image href="./wallsideref.jpg" x="0" y="0" transform="scale(0.4, 0.4)" /> -->
  <clipPath id="viewRect">
    <rect height="17in" width="11in" />
  </clipPath>
  <rect height="17in" width="11in" stroke="black" fill="none" />
  """

FOOTER = """
  <script type="text/javascript"><![CDATA[
    function makeDraggable(evt) {
        var svg = evt.target;

        svg.addEventListener('mousedown', startDrag);
        svg.addEventListener('mousemove', drag);
        svg.addEventListener('mouseup', endDrag);
        svg.addEventListener('mouseleave', endDrag);
        svg.addEventListener('touchstart', startDrag);
        svg.addEventListener('touchmove', drag);
        svg.addEventListener('touchend', endDrag);
        svg.addEventListener('touchleave', endDrag);
        svg.addEventListener('touchcancel', endDrag);

        function getMousePosition(evt) {
          var CTM = svg.getScreenCTM();
          if (evt.touches) { evt = evt.touches[0]; }
          return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
          };
        }

        var selectedElement, offset, transform;

        function initialiseDragging(evt) {
            offset = getMousePosition(evt);

            // Make sure the first transform on the element is a translate transform
            var transforms = selectedElement.transform.baseVal;

            if (transforms.length === 0 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
              // Create an transform that translates by (0, 0)
              var translate = svg.createSVGTransform();
              translate.setTranslate(0, 0);
              selectedElement.transform.baseVal.insertItemBefore(translate, 0);
            }

            // Get initial translation
            transform = transforms.getItem(0);
            offset.x -= transform.matrix.e;
            offset.y -= transform.matrix.f;
        }

        function startDrag(evt) {
          if (evt.target.classList.contains('draggable')) {
            selectedElement = evt.target;
            initialiseDragging(evt);
          } else if (evt.target.parentNode.classList.contains('draggable-group')) {
            selectedElement = evt.target.parentNode;
            initialiseDragging(evt);
          }
        }

        function drag(evt) {
          if (selectedElement) {
            evt.preventDefault();
            var coord = getMousePosition(evt);
            transform.setTranslate(coord.x - offset.x, coord.y - offset.y);
          }
        }

        function endDrag(evt) {
          selectedElement = false;
        }
      }

  ]]></script>

</svg>
"""

BODY = """
  <defs>
    <text id="en" x="0" y="0" transform="translate(0, -80)" class="text">WALL side</text>
    <text id="fr" x="0" y="0" transform="translate(-25, -56)" class="text">Côté MUR</text>
    <text id="es" x="0" y="0" transform="translate(-28, 0)" class="text">lado de la PARED</text>
    <text id="jp" x="0" y="0" transform="translate(-20, -27)" class="text japanese">かベ面</text>
  </defs>

  <g class="wallside">
    <!--
    <use href="#en" />
    <use href="#en" x="106" class="draggable" />
    <use href="#en" y="106" class="draggable" />
    <use href="#fr" />
    <use href="#fr" x="106" class="draggable" />
    <use href="#es" />
    <use href="#es" x="146" class="draggable" />
    <use href="#jp" />
    <use href="#jp" x="82" class="draggable" />
    -->
  </g>
"""


def make_line_def(id):
    print(f'<defs><g id="{id}">')
    for (lang, per) in Periods.x.items():
        for i in range(30 if lang == 'jp' else 20):
            print(f'<use x="{i * per}" xlink:href="#{lang}" />')
    print('</g></defs>')


def make_wallside():
    # 96px/in * {13in, 1.2in}
    print('<g clip-path="url(#viewRect)"><g transform="rotate(-45) translate(-1248, 115)">')
    for i in range(20):
        print(f'<use xlink:href="#line-10" y="{Periods.y * i}" />')
    print('</g></g>')


def main():
    f = open('./wallside.svg', 'w')
    with contextlib.redirect_stdout(f):
        build()
    print('built svg')


def build():
    print(HEADER)
    print(DEFS)
    make_line_def('line-10')
    make_wallside()
    print(BODY)
    print(FOOTER)


if __name__ == '__main__':
    main()
