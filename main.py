from mss import MSS

def main():
    """
    grab the screenshot with mss
    """
    with MSS() as sct:
        filename = sct.shot(mon=-1, output='fullscreen.png')
        print(filename)

if __name__ == "__main__":
    main()
