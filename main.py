import os
import PyPDF2

def list_pdfs_in_directory():
    """List all PDF files in the current directory."""
    pdf_files = [file for file in os.listdir() if file.endswith('.pdf')]
    if not pdf_files:
        print("No PDF files found in the current directory.")
        return None
    return pdf_files

def select_pdf_file(pdf_files):
    """Allow the user to select a PDF file from the available ones."""
    print("Available PDF files:")
    for idx, file in enumerate(pdf_files):
        print(f"{idx + 1}. {file}")
    
    while True:
        try:
            choice = int(input(f"Select a PDF file by number (1-{len(pdf_files)}): "))
            if 1 <= choice <= len(pdf_files):
                return pdf_files[choice - 1]
            else:
                print(f"Please enter a number between 1 and {len(pdf_files)}.")
        except ValueError:
            print("Invalid input. Please enter a valid number.")

def split_pdf(input_pdf_path, output_pdf1_path, output_pdf2_path, pages_for_pdf1):
    """Split the PDF based on the user's input."""
    with open(input_pdf_path, 'rb') as input_pdf_file:
        reader = PyPDF2.PdfReader(input_pdf_file)
        total_pages = len(reader.pages)
        
        writer1 = PyPDF2.PdfWriter()
        writer2 = PyPDF2.PdfWriter()
        
        for page_num in pages_for_pdf1:
            if page_num < total_pages:
                writer1.add_page(reader.pages[page_num])
            else:
                print(f"Page number {page_num + 1} is out of range, skipping...")
        
        for page_num in range(total_pages):
            if page_num not in pages_for_pdf1:
                writer2.add_page(reader.pages[page_num])
        
        with open(output_pdf1_path, 'wb') as output_pdf1_file:
            writer1.write(output_pdf1_file)
        
        with open(output_pdf2_path, 'wb') as output_pdf2_file:
            writer2.write(output_pdf2_file)

def keep_pages_in_pdf(input_pdf_path, output_pdf_path, pages_to_keep):
    """Keep specific pages in a PDF file."""
    with open(input_pdf_path, 'rb') as input_pdf_file:
        reader = PyPDF2.PdfReader(input_pdf_file)
        total_pages = len(reader.pages)
        
        writer = PyPDF2.PdfWriter()
        
        for page_num in pages_to_keep:
            if 0 <= page_num < total_pages:
                writer.add_page(reader.pages[page_num])
            else:
                print(f"Page number {page_num + 1} is out of range, skipping...")
        
        with open(output_pdf_path, 'wb') as output_pdf_file:
            writer.write(output_pdf_file)

def main():
    # List available PDF files in the current directory
    pdf_files = list_pdfs_in_directory()

    if pdf_files:
        # Allow the user to select a PDF file
        selected_pdf = select_pdf_file(pdf_files)

        # Display the menu options
        print("\nChoose an option:")
        print("1. Split PDF")
        print("2. Keep Specific Pages from PDF")

        while True:
            try:
                action_choice = int(input("Enter your choice (1 or 2): "))
                if action_choice == 1:
                    # Split PDF
                    output_pdf1_path = input("Enter the name of the first output PDF file (e.g., output1.pdf): ")
                    output_pdf2_path = input("Enter the name of the second output PDF file (e.g., output2.pdf): ")

                    # Get the page numbers for the first output PDF
                    pages_input = input("Enter the page numbers to include in the first PDF (comma-separated, 1-based indexing): ")

                    # Convert user input to a list of integers (0-based indexing)
                    pages_for_pdf1 = [int(page.strip()) - 1 for page in pages_input.split(',')]

                    # Call the function to split the PDF
                    split_pdf(selected_pdf, output_pdf1_path, output_pdf2_path, pages_for_pdf1)
                    break

                elif action_choice == 2:
                    # Keep Specific Pages from PDF
                    output_pdf_path = input("Enter the name of the output PDF file (e.g., output.pdf): ")

                    # Get the page numbers to keep
                    pages_input = input("Enter the page numbers to keep (comma-separated, 1-based indexing): ")

                    # Convert user input to a list of integers (0-based indexing)
                    pages_to_keep = [int(page.strip()) - 1 for page in pages_input.split(',')]

                    # Call the function to keep pages in the PDF
                    keep_pages_in_pdf(selected_pdf, output_pdf_path, pages_to_keep)
                    break
                else:
                    print("Please choose a valid option (1 or 2).")
            except ValueError:
                print("Invalid input. Please enter a valid number.")

    else:
        print("No PDFs available to process.")

if __name__ == "__main__":
    main()
