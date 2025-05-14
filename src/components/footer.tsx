import Container from "@/components/container";
import { EXAMPLE_PATH } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 dark:bg-slate-800">
      <Container>
        <div className="copyright">
          ver.4.01 / Author: @koppachappy / Since 2004.09.01
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
